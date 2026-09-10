export type FaqItem = {
  question: string;
  answer: string;
};

export const faqs: FaqItem[] = [
  {
    question: "How does the payment process work?",
    answer:
      "Pricing is custom and based on scope. After a brief, I send a quote for you to review. If you accept, invoices follow — which may be an advance, a milestone, a final payment, or a single invoice, depending on the project.",
  },
  {
    question: "Who pays for the domain and hosting?",
    answer:
      "That depends on the project. Source and hosting setup are agreed in the project scope. Some clients already have a domain and host; others need help setting those up as part of the work.",
  },
  {
    question: "Who owns the source code after the project is completed?",
    answer:
      "Handover of the finished site or app — including source and hosting setup — is agreed in the project scope. Confirm ownership and repository access before work begins if that matters for your team.",
  },
  {
    question: "How many revisions are included?",
    answer:
      "Review rounds are agreed in the project scope. There is no fixed revision package, so the number of rounds depends on what we write into the brief.",
  },
  {
    question: "Is post-launch support available?",
    answer:
      "Yes, when we include it in the project scope. Post-launch support is not a fixed package or a set number of weeks — we agree what is covered before the work starts.",
  },
  {
    question: "Can you redesign an existing website?",
    answer:
      "Yes. I can plan and rebuild an existing site so it is clearer, faster, and easier to maintain — or improve the version you already have. Tell me what is live today and what you want to change.",
  },
  {
    question: "How long does a typical website project take?",
    answer:
      "It depends on the project. Scope, content, and complexity all affect the schedule. When a service has an estimated timeline, it is shown on the Services page; otherwise we set dates after the brief.",
  },
];
