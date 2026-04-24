import { Role } from "@prisma/client";
import { ownerRegisterAccommodationAction } from "@/app/actions";
import { OwnerRegisterPropertyForm } from "@/components/owner-register-property-form";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RegisterPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
    redirect("/");
  }
  const query = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">רישום מקום האירוח שלכם</h1>
        <p className="text-sm text-slate-600">
          מלאו את פרטי הנכס: כתובת, עיר, מדינה, מיקום על מפה, תמונות, מחיר ופרטי אירוח.
        </p>
      </header>

      <OwnerRegisterPropertyForm error={query.error} action={ownerRegisterAccommodationAction} />
    </div>
  );
}
