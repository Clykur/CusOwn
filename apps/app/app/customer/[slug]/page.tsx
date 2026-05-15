import { notFound } from "next/navigation";
import { salonService } from "@cusown/shared/server";
import BusinessProfile from "@/components/salon/BusinessProfile";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CustomerBusinessProfilePage({ params }: Props) {
  const { slug } = await params;

  console.log("Customer route params (slug):", slug);

  if (!slug) {
    notFound();
  }

  const business = await salonService.getSalonByBookingLink(slug);

  if (!business) {
    notFound();
  }

  return <BusinessProfile />;
}
