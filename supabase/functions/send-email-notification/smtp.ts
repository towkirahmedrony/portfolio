// Minimal SMTP client for the Supabase Edge Runtime.
//
// Deliberately dependency-free: the edge runtime cannot reliably fetch remote
// modules at invocation time (importing denomailer from deno.land hangs), and
// Node-only SMTP packages are not usable here. This uses only Deno built-ins
// (Deno.connect / Deno.connectTls / Deno.startTls), which are available in the
// runtime and verified to reach smtp.gmail.com.
//
// Security: credentials are only ever held in memory inside this module. The
// password is never logged, never returned in a result object and never
// included in an error message.

export type SmtpCredentials = {
  host: string;
  port: number;
  user: string;
  /** Gmail app password. Never logged or returned. */
  pass: string;
  fromName?: string;
};

export type SmtpStage =
  | "connect"
  | "greeting"
  | "ehlo"
  | "starttls"
  | "auth"
  | "mail_from"
  | "rcpt_to"
  | "data"
  | "final";

export type SmtpResult =
  | { ok: true }
  | {
    ok: false;
    stage: SmtpStage;
    retryable: boolean;
    status?: number;
    message: string;
  };

export type MailMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64(bytes: Uint8Array): string {
  let out = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const c1 = bytes[i];
    const c2 = i + 1 < len ? bytes[i + 1] : 0;
    const c3 = i + 2 < len ? bytes[i + 2] : 0;
    out += B64_ALPHABET[c1 >> 2];
    out += B64_ALPHABET[((c1 & 0x03) << 4) | (c2 >> 4)];
    out += i + 1 < len ? B64_ALPHABET[((c2 & 0x0f) << 2) | (c3 >> 6)] : "=";
    out += i + 2 < len ? B64_ALPHABET[c3 & 0x3f] : "=";
  }
  return out;
}

function wrapBase64(value: string, width = 76): string {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += width) {
    chunks.push(value.slice(i, i + width));
  }
  return chunks.join("\r\n");
}

/** RFC 2047 encoding, only when the header is not plain ASCII. */
function encodeHeader(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ASCII range check
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${base64(encoder.encode(value))}?=`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function rfc5322Date(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${DAYS[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${
    MONTHS[date.getUTCMonth()]
  } ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${
    pad(date.getUTCMinutes())
  }:${pad(date.getUTCSeconds())} +0000`;
}

function buildMessage(msg: MailMessage, fromName?: string): string {
  const fromHeader = fromName
    ? `${encodeHeader(fromName)} <${msg.from}>`
    : msg.from;
  const domain = msg.from.split("@")[1] ?? "localhost";
  const boundary = `alt-${crypto.randomUUID()}`;

  const headers = [
    `Date: ${rfc5322Date(new Date())}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    `From: ${fromHeader}`,
    `To: ${msg.to}`,
    `Reply-To: ${msg.replyTo ?? msg.from}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "Auto-Submitted: auto-generated",
  ];

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(base64(encoder.encode(msg.text))),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(base64(encoder.encode(msg.html))),
    "",
    `--${boundary}--`,
    "",
  ];

  return [...headers, "", ...body].join("\r\n");
}

type Session = {
  conn: Deno.Conn;
  carry: string;
  buf: Uint8Array;
  dec: TextDecoder;
  deadline: number;
};

/** Stages where a failure provably means no message was accepted. */
const RETRYABLE_STAGES: SmtpStage[] = [
  "connect",
  "greeting",
  "ehlo",
  "starttls",
  "auth",
  "mail_from",
  "rcpt_to",
];

const isRetryableCode = (code: number) =>
  code === 421 || code === 450 || code === 451 || code === 452 || code === 454;

function deadlineError(deadline: number, what: string): Error {
  return new Error(`${what} exceeded the ${deadline - Date.now()}ms budget`);
}

async function withDeadline<T>(
  promise: Promise<T>,
  deadline: number,
  what: string,
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw deadlineError(deadline, what);
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(deadlineError(deadline, what)),
          remaining,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function writeAll(session: Session, data: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < data.length) {
    offset += await withDeadline(
      session.conn.write(data.subarray(offset)),
      session.deadline,
      "smtp write",
    );
  }
}

async function readReply(
  session: Session,
): Promise<{ code: number; text: string }> {
  const lines: string[] = [];
  let code = 0;
  for (;;) {
    let index = session.carry.indexOf("\r\n");
    while (index === -1) {
      const read = await withDeadline(
        session.conn.read(session.buf),
        session.deadline,
        "smtp read",
      );
      if (read === null) throw new Error("connection closed by server");
      session.carry += session.dec.decode(session.buf.subarray(0, read), {
        stream: true,
      });
      index = session.carry.indexOf("\r\n");
    }
    const line = session.carry.slice(0, index);
    session.carry = session.carry.slice(index + 2);
    lines.push(line);
    const match = /^(\d{3})([ -]?)/.exec(line);
    if (!match) continue;
    code = Number(match[1]);
    if (match[2] === " ") break;
  }
  return { code, text: lines.join(" | ").slice(0, 300) };
}

async function command(
  session: Session,
  line: string,
  redact = false,
): Promise<{ code: number; text: string }> {
  await writeAll(session, encoder.encode(`${line}\r\n`));
  const reply = await readReply(session);
  if (redact && reply.text.includes(line) && line.length > 0) {
    reply.text = reply.text.replaceAll(line, "[redacted]");
  }
  return reply;
}

function fail(
  stage: SmtpStage,
  reply: { code: number; text: string },
): SmtpResult {
  return {
    ok: false,
    stage,
    retryable: isRetryableCode(reply.code),
    status: reply.code,
    message: `SMTP ${reply.code}: ${reply.text}`.slice(0, 300),
  };
}

const CLIENT_NAME = "supabase-edge-function";

export async function sendMail(
  credentials: SmtpCredentials,
  message: MailMessage,
  timeoutMs = 25000,
): Promise<SmtpResult> {
  const { host, port, user, pass, fromName } = credentials;
  const deadline = Date.now() + timeoutMs;
  let stage: SmtpStage = "connect";
  let session: Session | null = null;

  try {
    const implicitTls = port === 465;
    const conn = implicitTls
      ? await withDeadline(
        Deno.connectTls({ hostname: host, port }),
        deadline,
        "smtp connectTls",
      )
      : await withDeadline(
        Deno.connect({ hostname: host, port }),
        deadline,
        "smtp connect",
      );

    session = {
      conn,
      carry: "",
      buf: new Uint8Array(4096),
      dec: new TextDecoder(),
      deadline,
    };

    stage = "greeting";
    const greeting = await readReply(session);
    if (greeting.code !== 220) return fail(stage, greeting);

    stage = "ehlo";
    let ehlo = await command(session, `EHLO ${CLIENT_NAME}`);
    if (ehlo.code !== 250) return fail(stage, ehlo);

    if (!implicitTls) {
      if (!/STARTTLS/i.test(ehlo.text)) {
        return {
          ok: false,
          stage: "ehlo",
          retryable: false,
          message: "Server does not advertise STARTTLS",
        };
      }
      stage = "starttls";
      const startTls = await command(session, "STARTTLS");
      if (startTls.code !== 220) return fail(stage, startTls);
      const startTlsFn = (Deno as unknown as {
        startTls?: (
          conn: Deno.Conn,
          options: { hostname: string },
        ) => Promise<Deno.Conn>;
      }).startTls;
      if (typeof startTlsFn !== "function") {
        return {
          ok: false,
          stage: "starttls",
          retryable: false,
          message: "Deno.startTls is unavailable in this runtime",
        };
      }
      session.conn = await withDeadline(
        startTlsFn(session.conn, { hostname: host }),
        deadline,
        "smtp startTls",
      );
      ehlo = await command(session, `EHLO ${CLIENT_NAME}`);
      if (ehlo.code !== 250) return fail("ehlo", ehlo);
    }

    stage = "auth";
    const authStart = await command(session, "AUTH LOGIN");
    if (authStart.code !== 334) return fail(stage, authStart);
    const authUser = await command(
      session,
      base64(encoder.encode(user)),
      true,
    );
    if (authUser.code !== 334) return fail(stage, authUser);
    const authPass = await command(
      session,
      base64(encoder.encode(pass)),
      true,
    );
    if (authPass.code !== 235) return fail(stage, authPass);

    stage = "mail_from";
    const mailFrom = await command(session, `MAIL FROM:<${user}>`);
    if (mailFrom.code !== 250) return fail(stage, mailFrom);

    stage = "rcpt_to";
    const rcptTo = await command(session, `RCPT TO:<${message.to}>`);
    if (rcptTo.code !== 250 && rcptTo.code !== 251) return fail(stage, rcptTo);

    stage = "data";
    const data = await command(session, "DATA");
    if (data.code !== 354) return fail(stage, data);

    // Base64 bodies can never start a line with "." so no dot-stuffing needed.
    await writeAll(
      session,
      encoder.encode(`${buildMessage(message, fromName)}\r\n.\r\n`),
    );

    stage = "final";
    const accepted = await readReply(session);
    if (accepted.code !== 250) return fail(stage, accepted);

    try {
      await command(session, "QUIT");
    } catch {
      // The message was already accepted; a failed QUIT is irrelevant.
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      stage,
      retryable: RETRYABLE_STAGES.includes(stage),
      message: String(error).slice(0, 300),
    };
  } finally {
    try {
      session?.conn.close();
    } catch {
      // already closed
    }
  }
}
