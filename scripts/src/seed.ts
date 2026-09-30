import { db } from "@workspace/db";
import {
  citiesTable,
  productsTable,
  districtsTable,
  settingsTable,
} from "@workspace/db";

async function seed() {
  // Seed settings
  const existingSettings = await db.select().from(settingsTable).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(settingsTable).values({
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? null,
      adminTelegramId: null,
      welcomeMessage: "Witaj w sklepie! Wybierz opcje z menu ponizej.",
      operatorUsername: "Operator",
      rulesText: "1. Minimum zakupu: 1 porcja.\n2. Platnosc z gory.\n3. Zamowienie realizowane w ciagu 30 minut.\n4. Brak mozliwosci zwrotu.",
      webhookUrl: null,
    });
    console.log("Settings seeded");
  }

  // Seed cities
  const existingCities = await db.select().from(citiesTable).limit(1);
  if (existingCities.length > 0) {
    console.log("Cities already seeded, skipping");
    return;
  }

  const [czestochowa] = await db
    .insert(citiesTable)
    .values({
      name: "CZESTOCHOWA",
      emoji: "🏠",
      isActive: true,
    })
    .returning();

  const [krakow] = await db
    .insert(citiesTable)
    .values({
      name: "KRAKOW",
      emoji: "🏛️",
      isActive: true,
    })
    .returning();

  const [warszawa] = await db
    .insert(citiesTable)
    .values({
      name: "WARSZAWA",
      emoji: "🏙️",
      isActive: true,
    })
    .returning();

  console.log("Cities seeded");

  // Seed products for Czestochowa
  await db.insert(productsTable).values([
    { cityId: czestochowa.id, name: "Kamien", emoji: "💎", pricePln: "65", weightGrams: "1", isActive: true },
    { cityId: czestochowa.id, name: "Kamien", emoji: "💎", pricePln: "275", weightGrams: "5", isActive: true },
    { cityId: czestochowa.id, name: "Trawa", emoji: "🍀", pricePln: "130", weightGrams: "2", isActive: true },
    { cityId: czestochowa.id, name: "Trawa", emoji: "🍀", pricePln: "70", weightGrams: "1", isActive: true },
  ]);

  await db.insert(productsTable).values([
    { cityId: krakow.id, name: "Kamien", emoji: "💎", pricePln: "65", weightGrams: "1", isActive: true },
    { cityId: krakow.id, name: "Kamien", emoji: "💎", pricePln: "275", weightGrams: "5", isActive: true },
    { cityId: krakow.id, name: "Trawa", emoji: "🍀", pricePln: "130", weightGrams: "2", isActive: true },
  ]);

  await db.insert(productsTable).values([
    { cityId: warszawa.id, name: "Kamien", emoji: "💎", pricePln: "65", weightGrams: "1", isActive: true },
    { cityId: warszawa.id, name: "Trawa", emoji: "🍀", pricePln: "130", weightGrams: "2", isActive: true },
  ]);

  console.log("Products seeded");

  // Seed districts
  await db.insert(districtsTable).values([
    { cityId: czestochowa.id, name: "TYSIACLECIA", isActive: true },
    { cityId: czestochowa.id, name: "POLNOC", isActive: true },
    { cityId: czestochowa.id, name: "STARE MIASTO", isActive: true },
    { cityId: czestochowa.id, name: "GRABOWKA", isActive: true },
    { cityId: czestochowa.id, name: "ZAWODZIE-DABIE", isActive: true },
    { cityId: czestochowa.id, name: "STRADOM", isActive: true },
    { cityId: czestochowa.id, name: "LISINIEC", isActive: true },
    { cityId: czestochowa.id, name: "SRODMIESCIE", isActive: true },
    { cityId: czestochowa.id, name: "WYCZERPY-ANIOLOW", isActive: true },
    { cityId: czestochowa.id, name: "OSTATNI GROSZ", isActive: true },
    { cityId: czestochowa.id, name: "PARKITKA", isActive: true },
    { cityId: czestochowa.id, name: "WRZOSOWIAK", isActive: true },
  ]);

  await db.insert(districtsTable).values([
    { cityId: krakow.id, name: "STARE MIASTO", isActive: true },
    { cityId: krakow.id, name: "KAZIMIERZ", isActive: true },
    { cityId: krakow.id, name: "KROWODRZA", isActive: true },
    { cityId: krakow.id, name: "PODGORZE", isActive: true },
    { cityId: krakow.id, name: "NOWA HUTA", isActive: true },
  ]);

  await db.insert(districtsTable).values([
    { cityId: warszawa.id, name: "SRODMIESCIE", isActive: true },
    { cityId: warszawa.id, name: "PRAGA POLNOC", isActive: true },
    { cityId: warszawa.id, name: "WOLA", isActive: true },
    { cityId: warszawa.id, name: "MOKOTOW", isActive: true },
    { cityId: warszawa.id, name: "URSYNOW", isActive: true },
  ]);

  console.log("Districts seeded");
  console.log("Seed complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
