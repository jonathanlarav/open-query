import { ReportDetailView } from '@/components/reports/ReportDetailView';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function ReportDetailPage({ params }: Props) {
  const { sessionId } = await params;
  return <ReportDetailView sessionId={sessionId} />;
}
