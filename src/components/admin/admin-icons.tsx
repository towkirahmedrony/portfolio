import type { ReactNode } from "react";
import type { AdminNavIcon } from "@/types/admin";

type IconProps = {
  className?: string;
};

function Icon({
  children,
  className,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

function DashboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M4 4h7v9H4V4Zm9 0h7v5h-7V4ZM13 11h7v9h-7v-9ZM4 15h7v5H4v-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

function ProfileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5.5 19.5c1.2-3.2 3.5-4.8 6.5-4.8s5.3 1.6 6.5 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

function OrdersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect
        x="4.5"
        y="7"
        width="15"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

function ProjectsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 12 4 8.5M12 12l8-3.5M12 12v8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </Icon>
  );
}

function ClientsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.5 19c.8-3 2.8-4.5 4.5-4.5s3.7 1.5 4.5 4.5M13.5 19c.5-2 1.8-3.2 3.5-3.2 1.2 0 2.2.6 3 1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

function QuotesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M7 8h10M7 12h7M7 16h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </Icon>
  );
}

function InvoicesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15l-3-1.5-3 1.5-3-1.5-3 1.5V5A1.5 1.5 0 0 1 7 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 8h7M8.5 12h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

function PaymentsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect
        x="3.5"
        y="6"
        width="17"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 15h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

function ReferralsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="16" r="2.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9 9.5 10.5 14M15 9.5 13.5 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

function MessagesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M5 6h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 17H9l-4.5 3v-3H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

function NotificationsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M6 17h12l-1.2-2.4A5.5 5.5 0 0 1 16 11.5V10a4 4 0 1 0-8 0v1.5c0 1.1-.3 2.2-.8 3.1L6 17Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 17a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

function PortfolioIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect
        x="3.5"
        y="7"
        width="17"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 7V6a3 3 0 0 1 6 0v1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

function ServicesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M12 3.5 14.2 8l4.8.7-3.5 3.4.8 4.8L12 14.8 7.7 16.9l.8-4.8L5 8.7 9.8 8 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

function ReviewsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M12 4.5 13.9 9l4.8.7-3.5 3.4.8 4.8L12 15.6 7.9 18l.8-4.8L5.2 9.7 10 9 12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

function FilesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M7 4h7l5 5v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5.5A1.5 1.5 0 0 1 7 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 4v5h5" stroke="currentColor" strokeWidth="1.6" />
    </Icon>
  );
}

function AuditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m15.5 15.5 4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M5 7h14M5 12h14M5 17h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M7 7l10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Icon>
  );
}

const navIcons: Record<
  AdminNavIcon,
  (props: IconProps) => ReactNode
> = {
  dashboard: DashboardIcon,
  profile: ProfileIcon,
  settings: SettingsIcon,
  orders: OrdersIcon,
  projects: ProjectsIcon,
  clients: ClientsIcon,
  quotes: QuotesIcon,
  invoices: InvoicesIcon,
  payments: PaymentsIcon,
  referrals: ReferralsIcon,
  messages: MessagesIcon,
  notifications: NotificationsIcon,
  portfolio: PortfolioIcon,
  services: ServicesIcon,
  reviews: ReviewsIcon,
  files: FilesIcon,
  audit: AuditIcon,
};

export function AdminNavIcon({
  name,
  className,
}: {
  name: AdminNavIcon;
  className?: string;
}) {
  const Component = navIcons[name];
  return <Component className={className} />;
}

export { MenuIcon, CloseIcon };
