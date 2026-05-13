const LOCATION_ALIAS_GROUPS = [
  // Israel
  ["israel", "ישראל", "eretz israel"],
  ["tel aviv", "tel-aviv", "תל אביב", "תל-אביב", "תא"],
  ["jerusalem", "ירושלים"],
  ["haifa", "חיפה"],
  ["eilat", "אילת"],
  ["tiberias", "טבריה"],
  ["netanya", "נתניה"],
  ["ashdod", "אשדוד"],
  ["ashkelon", "אשקלון"],
  ["beer sheva", "be'er sheva", "beersheba", "באר שבע"],
  ["nazareth", "נצרת"],
  ["acre", "akko", "עכו"],
  ["safed", "tzfat", "צפת"],
  ["herzliya", "הרצליה"],
  ["rishon lezion", "rishon le-zion", "ראשון לציון"],
  ["petah tikva", "פתח תקווה"],
  ["bat yam", "בת ים"],
  ["holon", "חולון"],
  ["ramat gan", "רמת גן"],
  ["dead sea", "dead-sea", "ים המלח"],
  ["sea of galilee", "galilee", "כנרת", "הכנרת", "גליל"],
  ["golan", "golan heights", "רמת הגולן", "גולן"],
  // Greece
  ["greece", "יוון", "hellas"],
  ["athens", "אתונה"],
  ["thessaloniki", "salonika", "סלוניקי", "תסלוניקי"],
  ["crete", "כרתים"],
  ["heraklion", "הרקליון"],
  ["chania", "חאניה", "כניה"],
  ["rhodes", "רודוס"],
  ["santorini", "סנטוריני"],
  ["mykonos", "מיקונוס"],
  ["corfu", "קורפו"],
  ["zakynthos", "zante", "זקינתוס"],
  ["kos", "קוס"],
  ["patras", "פטרס"],
  ["nafplio", "נאפפליו"],
  // Cyprus
  ["cyprus", "קפריסין"],
  ["paphos", "פאפוס"],
  ["limassol", "לימסול"],
  ["larnaca", "לרנקה"],
  ["nicosia", "ניקוסיה"],
  ["ayia napa", "agia napa", "איה נאפה", "איה-נאפה"],
  ["protaras", "פרוטארס"],
  // Italy
  ["italy", "איטליה"],
  ["rome", "roma", "רומא"],
  ["milan", "milano", "מילאנו"],
  ["venice", "venezia", "ונציה"],
  ["florence", "firenze", "פירנצה"],
  ["naples", "napoli", "נאפולי"],
  ["bologna", "בולוניה"],
  ["turin", "torino", "טורינו"],
  ["sicily", "sicilia", "סיציליה"],
  ["palermo", "פלרמו"],
  ["catania", "קטניה"],
  ["amalfi", "amalfi coast", "אמלפי", "חוף אמלפי"],
  // France
  ["france", "צרפת"],
  ["paris", "פריז"],
  ["nice", "ניס"],
  ["lyon", "ליון"],
  ["marseille", "מרסיי"],
  ["cannes", "קאן"],
  ["toulouse", "טולוז"],
  ["bordeaux", "בורדו"],
  ["strasbourg", "שטרסבורג"],
  // Global
  ["spain", "ספרד"],
  ["barcelona", "ברצלונה"],
  ["madrid", "מדריד"],
  ["portugal", "פורטוגל"],
  ["lisbon", "lisboa", "ליסבון"],
  ["porto", "oporto", "פורטו"],
  ["united kingdom", "uk", "britain", "england", "בריטניה", "אנגליה"],
  ["london", "לונדון"],
  ["manchester", "מנצ'סטר"],
  ["united states", "usa", "u s a", "america", "ארהב", "ארצות הברית", "אמריקה"],
  ["new york", "new-york", "ניו יורק"],
  ["los angeles", "la", "לוס אנג'לס", "לוס אנגלס"],
  ["miami", "מיאמי"],
  ["las vegas", "וגאס", "לאס וגאס"],
  ["orlando", "אורלנדו"],
  ["uae", "united arab emirates", "אמירויות", "איחוד האמירויות"],
  ["dubai", "דובאי"],
  ["abu dhabi", "אבו דאבי"],
  ["thailand", "תאילנד"],
  ["bangkok", "בנגקוק"],
  ["phuket", "פוקט"],
  ["koh samui", "samui", "קו סמוי"],
  ["japan", "יפן"],
  ["tokyo", "טוקיו"],
  ["osaka", "אוסקה"],
  ["turkey", "türkiye", "טורקיה"],
  ["istanbul", "איסטנבול"],
  ["antalya", "אנטליה"],
  ["germany", "גרמניה"],
  ["berlin", "ברלין"],
  ["munich", "munchen", "מינכן"],
  ["austria", "אוסטריה"],
  ["vienna", "וינה"],
  ["switzerland", "שוויץ"],
  ["zurich", "zürich", "ציריך"],
  ["geneva", "ז'נבה"],
  ["netherlands", "holland", "הולנד"],
  ["amsterdam", "אמסטרדם"],
  ["czech republic", "czechia", "צ'כיה"],
  ["prague", "praha", "פראג"],
  ["hungary", "הונגריה"],
  ["budapest", "בודפשט"],
  ["croatia", "קרואטיה"],
  ["split", "ספליט"],
  ["dubrovnik", "דוברובניק"],
  ["bulgaria", "בולגריה"],
  ["sofia", "סופיה"],
  ["georgia", "גאורגיה", "גרוזיה"],
  ["tbilisi", "טביליסי"],
  ["batumi", "בטומי"],
  ["egypt", "מצרים"],
  ["cairo", "קהיר"],
  ["sharm el sheikh", "sharm", "שארם א שייח", "שארם אל שייח"],
  ["morocco", "מרוקו"],
  ["marrakech", "מרקש"],
] as const;

export function normalizeLocationText(value?: string) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function buildLocationNeedles(value?: string) {
  const normalizedQuery = normalizeLocationText(value);
  if (!normalizedQuery) {
    return [] as string[];
  }

  const needles = new Set<string>([normalizedQuery]);
  for (const aliasGroup of LOCATION_ALIAS_GROUPS) {
    const normalizedAliases = aliasGroup
      .map((alias) => normalizeLocationText(alias))
      .filter(Boolean);
    const shouldExpand = normalizedAliases.some(
      (alias) => alias.includes(normalizedQuery) || normalizedQuery.includes(alias),
    );
    if (!shouldExpand) {
      continue;
    }
    normalizedAliases.forEach((alias) => needles.add(alias));
  }

  return Array.from(needles);
}

export function includesAnyLocationNeedle(
  value: string | null | undefined,
  needles: readonly string[],
) {
  if (needles.length === 0) {
    return true;
  }
  const normalizedValue = normalizeLocationText(value ?? "");
  if (!normalizedValue) {
    return false;
  }
  return needles.some((needle) => normalizedValue.includes(needle));
}