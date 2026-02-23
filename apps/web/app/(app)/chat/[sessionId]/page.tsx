import { ChatInterface } from '@/components/chat/ChatInterface';

interface ChatSessionPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function ChatSessionPage({ params }: ChatSessionPageProps) {
  const { sessionId } = await params;
  return <ChatInterface sessionId={sessionId} />;
}
