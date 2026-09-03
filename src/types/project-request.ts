export type ProjectType =
  | "business"
  | "portfolio"
  | "ecommerce"
  | "landing"
  | "blog"
  | "web-application"
  | "custom";

export type WebsiteStatus = "new" | "redesign";

export type ProjectFeature =
  | "contact-form"
  | "user-login"
  | "payment"
  | "ecommerce"
  | "blog"
  | "search"
  | "admin-panel"
  | "booking"
  | "chat"
  | "other";

export type DesignStyle =
  | "minimal"
  | "modern"
  | "corporate"
  | "creative"
  | "luxury"
  | "other";

export type YesNo = "yes" | "no";

export type BudgetRange =
  | "under-100"
  | "100-300"
  | "300-500"
  | "500-1000"
  | "1000-plus";

export type Deadline =
  | "flexible"
  | "1-week"
  | "1-2-weeks"
  | "2-4-weeks"
  | "1-2-months"
  | "specific";

export type ProjectRequest = {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  referralCode: string;
  projectType: ProjectType | "";
  websiteStatus: WebsiteStatus | "";
  pageCount: string;
  description: string;
  features: ProjectFeature[];
  additionalRequirements: string;
  hasDesign: YesNo | "";
  referenceUrls: string;
  designStyle: DesignStyle | "";
  designStyleOther: string;
  hasLogo: YesNo | "";
  hasBrandColors: YesNo | "";
  budget: BudgetRange | "";
  deadline: Deadline | "";
  specificDate: string;
};

export type ProjectRequestErrors = Partial<
  Record<keyof ProjectRequest, string>
>;

export type ProjectRequestStep = 1 | 2 | 3 | 4 | 5 | 6;
