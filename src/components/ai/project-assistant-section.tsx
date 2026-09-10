import { ProjectAssistant } from "@/components/ai/project-assistant";
import { Section } from "@/components/ui/section";

export function ProjectAssistantSection({
  compact = false,
  title,
  description,
}: {
  compact?: boolean;
  title?: string;
  description?: string;
}) {
  return (
    <Section id="ask" className="scroll-mt-24">
      <ProjectAssistant compact={compact} title={title} description={description} />
    </Section>
  );
}
