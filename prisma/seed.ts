import bcrypt from "bcryptjs";
import { DashboardRole, HotelStatus, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.session.deleteMany();
  await prisma.userActivityLog.deleteMany();
  await prisma.userLoginHistory.deleteMany();
  await prisma.hotelApiSyncLog.deleteMany();
  await prisma.hotelApiProvider.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.review.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Pass1234!", 10);

  const [guest, owner, admin] = await Promise.all([
    prisma.user.create({
      data: {
        name: "אורח לדוגמה",
        email: "guest@bookmenow.co.il",
        passwordHash,
        role: Role.GUEST,
        dashboardRole: DashboardRole.VIEWER,
      },
    }),
    prisma.user.create({
      data: {
        name: "בעל מלון לדוגמה",
        email: "owner@bookmenow.co.il",
        passwordHash,
        role: Role.OWNER,
        dashboardRole: DashboardRole.MANAGER,
      },
    }),
    prisma.user.create({
      data: {
        name: "מנהל מערכת",
        email: "admin@bookmenow.co.il",
        passwordHash,
        role: Role.ADMIN,
        dashboardRole: DashboardRole.ADMIN,
      },
    }),
  ]);

  const hotel = await prisma.hotel.create({
    data: {
      ownerId: owner.id,
      name: "מלון הים תל אביב",
      location: "תל אביב",
      description: "מלון אורבני במרכז העיר עם גישה מהירה לחוף.",
      facilities: ["wifi", "חניה", "בריכה", "ארוחת בוקר"],
      images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945"],
      status: HotelStatus.APPROVED,
    },
  });

  const room = await prisma.roomType.create({
    data: {
      hotelId: hotel.id,
      name: "חדר דלוקס זוגי",
      pricePerNight: 550,
      maxGuests: 2,
      inventory: 4,
      availableInventory: 4,
      isAvailable: true,
      photos: [
        "https://images.unsplash.com/photo-1590490360182-c33d57733427",
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a",
      ],
      cancellationPolicy: "ביטול חינם עד 48 שעות לפני הגעה",
    },
  });

  await prisma.booking.create({
    data: {
      userId: guest.id,
      hotelId: hotel.id,
      roomTypeId: room.id,
      checkIn: new Date("2026-05-10"),
      checkOut: new Date("2026-05-12"),
      guests: 2,
      totalPrice: 1100,
    },
  });

  await prisma.hotel.create({
    data: {
      ownerId: owner.id,
      name: "מלון כרמל חיפה",
      location: "חיפה",
      description: "מלון בוטיק עם נוף להר הכרמל.",
      facilities: ["wifi", "ספא"],
      images: ["https://images.unsplash.com/photo-1551882547-ff40c63fe5fa"],
      status: HotelStatus.PENDING,
    },
  });

  console.log("Seed completed. Login password for all users: Pass1234!");
  console.log(`Guest: ${guest.email}`);
  console.log(`Owner: ${owner.email}`);
  console.log(`Admin: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
