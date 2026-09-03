import type {
  BudgetRange,
  Deadline,
  DesignStyle,
  ProjectFeature,
  ProjectRequest,
  ProjectType,
  WebsiteStatus,
  YesNo,
} from "@/types/project-request";

export const TOTAL_STEPS = 6 as const;

export const stepMeta = [
  { id: 1, title: "Client", description: "Your details" },
  { id: 2, title: "Type", description: "What to build" },
  { id: 3, title: "Scope", description: "Requirements" },
  { id: 4, title: "Design", description: "Look and feel" },
  { id: 5, title: "Timing", description: "Budget and deadline" },
  { id: 6, title: "Review", description: "Confirm and send" },
] as const;

export const initialProjectRequest: ProjectRequest = {
  fullName: "",
  email: "",
  phone: "",
  company: "",
  projectType: "",
  websiteStatus: "",
  pageCount: "",
  description: "",
  features: [],
  additionalRequirements: "",
  hasDesign: "",
  referenceUrls: "",
  designStyle: "",
  designStyleOther: "",
  hasLogo: "",
  hasBrandColors: "",
  budget: "",
  deadline: "",
  specificDate: "",
};

export const projectTypeOptions: Array<{ value: ProjectType; label: string }> = [
  { value: "business", label: "Business Website" },
  { value: "portfolio", label: "Portfolio Website" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "landing", label: "Landing Page" },
  { value: "blog", label: "Blog" },
  { value: "web-application", label: "Web Application" },
  { value: "custom", label: "Custom / Other" },
];

export const websiteStatusOptions: Array<{
  value: WebsiteStatus;
  label: string;
  description: string;
}> = [
  {
    value: "new",
    label: "New website",
    description: "Starting from a blank page.",
  },
  {
    value: "redesign",
    label: "Redesign / Existing website",
    description: "Improving or replacing a current site.",
  },
];

export const featureOptions: Array<{ value: ProjectFeature; label: string }> = [
  { value: "contact-form", label: "Contact Form" },
  { value: "user-login", label: "User Login" },
  { value: "payment", label: "Payment" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "blog", label: "Blog" },
  { value: "search", label: "Search" },
  { value: "admin-panel", label: "Admin Panel" },
  { value: "booking", label: "Booking System" },
  { value: "chat", label: "Chat" },
  { value: "other", label: "Other" },
];

export const designStyleOptions: Array<{ value: DesignStyle; label: string }> = [
  { value: "minimal", label: "Minimal" },
  { value: "modern", label: "Modern" },
  { value: "corporate", label: "Corporate" },
  { value: "creative", label: "Creative" },
  { value: "luxury", label: "Luxury" },
  { value: "other", label: "Other" },
];

export const yesNoOptions: Array<{ value: YesNo; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const budgetOptions: Array<{ value: BudgetRange; label: string }> = [
  { value: "under-100", label: "Under $100" },
  { value: "100-300", label: "$100–$300" },
  { value: "300-500", label: "$300–$500" },
  { value: "500-1000", label: "$500–$1,000" },
  { value: "1000-plus", label: "$1,000+" },
];

export const deadlineOptions: Array<{ value: Deadline; label: string }> = [
  { value: "flexible", label: "Flexible" },
  { value: "1-week", label: "Within 1 week" },
  { value: "1-2-weeks", label: "1–2 weeks" },
  { value: "2-4-weeks", label: "2–4 weeks" },
  { value: "1-2-months", label: "1–2 months" },
  { value: "specific", label: "Specific date" },
];

export const pageCountOptions = [
  "1–3 pages",
  "4–6 pages",
  "7–10 pages",
  "10+ pages",
  "Not sure yet",
] as const;

export function getOptionLabel<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T | "",
): string {
  if (!value) {
    return "Not specified";
  }

  return options.find((option) => option.value === value)?.label ?? value;
}
