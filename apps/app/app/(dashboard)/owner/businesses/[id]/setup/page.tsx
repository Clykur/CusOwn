import BusinessSetupFlow from '@/components/owner/business-setup-flow';

export default async function OwnerBusinessSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) {
    return null;
  }
  return <BusinessSetupFlow businessId={id} />;
}
