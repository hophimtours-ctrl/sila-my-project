import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role === Role.ADMIN) {
    redirect("/admin/super");
  }
  if (user.role === Role.OWNER) {
    redirect("/admin/hotels");
  }
  redirect("/");
}
