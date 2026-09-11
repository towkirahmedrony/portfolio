import { DifyChatbot } from "@/components/ai/dify-chatbot";
import { Section } from "@/components/ui/section";

export function ProjectAssistantSection() {
  return (
    <Section id="ask" className="scroll-mt-24">
      <DifyChatbot autoOpen={false} />
    </Section>
  );
}
