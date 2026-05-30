"use client";
import { useParams, useRouter } from "next/navigation";
import { MemberDetailModal } from "@/components/MemberDetailModal";

export default function MemberModalPage() {
  const params = useParams();
  const router = useRouter();
  const name = decodeURIComponent(params.name as string);

  return <MemberDetailModal name={name} onClose={() => router.back()} />;
}
