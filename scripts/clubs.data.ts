// The consumer-club catalog itself, kept apart from scripts/seed-clubs.ts so it
// can be imported without running a seed: tests/unit/clubCatalog.test.ts checks
// every logoUrl against the files actually committed under public/clubs/, and
// importing the script would have written to Firestore as a side effect.
//
// Every website below was resolved by hand rather than guessed, because three
// of the obvious spellings are wrong: חבר is hvr.co.il (not hever), בהצדעה is
// behatsdaa (not behatzdaa), and the מפעל הפיס benefits programme lives at
// paisplus.co.il rather than on the lottery's own site.
//
// logoUrl points at a file committed under public/clubs/. Each is the club's
// own icon, taken from its App Store or Google Play listing (or, for חבר,
// the apple-touch-icon on hvr.co.il), used to identify the club whose card the
// user holds. Local copies, never hotlinks — see the note on Club.logoUrl.
import type { SeedClub } from "../src/lib/services/clubCatalog";

// A club with a single tier still gets one card: a membership always points at
// a card, never at a club (ADR #61). "כרטיס המועדון" rather than "רגיל" there,
// since there is no other tier for it to be regular in contrast to.
const SINGLE_TIER = [{ id: "regular", name: "כרטיס המועדון", description: "" }];

export const CATALOG: SeedClub[] = [
  {
    id: "mifal-hapais",
    name: "מפעל הפיס",
    description: "מועדון ההטבות של מנויי מפעל הפיס (פיס פלוס).",
    website: "https://paisplus.co.il",
    logoUrl: "/clubs/mifal-hapais.jpg",
    color: "#1b3281",
    // The only club here with more than one tier, and the reason the model has
    // two levels at all. Note that פיס פלוס itself publishes four eligibility
    // levels (כסף / זהב / זהב+ / פלטינום, by seniority and number of
    // subscriptions) and reserves its "VIP+" benefits for the top two; רגיל/VIP
    // is the simplification the product asked for. If layer 10.2 needs to match
    // a benefit to a tier, this is the list that has to grow.
    cards: [
      { id: "regular", name: "רגיל", description: "" },
      { id: "vip", name: "VIP", description: "" },
    ],
  },
  {
    id: "hever",
    name: "חבר",
    description: 'מועדון הצרכנות של משרתי הקבע, גמלאי צה"ל ועובדי מערכת הביטחון.',
    website: "https://www.hvr.co.il",
    logoUrl: "/clubs/hever.png",
    color: "#e6007e",
    cards: SINGLE_TIER,
  },
  {
    id: "shavve",
    name: "שווה",
    description: "מועדון הצרכנות של ההסתדרות הלאומית.",
    website: "https://www.shavve.co.il",
    logoUrl: "/clubs/shavve.jpg",
    color: "#0a2240",
    cards: SINGLE_TIER,
  },
  {
    id: "behatsdaa",
    name: "בהצדעה",
    description: 'מועדון ההטבות למשרתי מילואים פעילים ולמשוחררי צה"ל, עד שלוש שנים מהשחרור.',
    website: "https://www.behatsdaa.org.il",
    logoUrl: "/clubs/behatsdaa.png",
    color: "#e5187f",
    cards: SINGLE_TIER,
  },
  {
    id: "hot",
    name: "הוט",
    description: "מועדון הצרכנות של הסתדרות ההנדסאים והטכנאים — הנדסאים, טכנאים, מהנדסים ואנשי הייטק.",
    website: "https://www.hot.co.il",
    logoUrl: "/clubs/hot.jpg",
    color: "#7c3aed",
    cards: SINGLE_TIER,
  },
  {
    id: "tov",
    name: "טוב+",
    description: "מועדון ההטבות של עובדי המדינה.",
    website: "https://www.tovplus.org.il",
    logoUrl: "/clubs/tov.png",
    color: "#a81f2a",
    cards: SINGLE_TIER,
  },
  {
    id: "ashmoret",
    name: "אשמורת",
    description: "מועדון ההטבות של הסתדרות המורים.",
    // No live site to link to: itu.org.il is suspended and ashmoret.co.il
    // redirects to an empty page. The club is reachable through its app only.
    website: null,
    logoUrl: "/clubs/ashmoret.png",
    color: "#2d7ff9",
    cards: SINGLE_TIER,
  },
];
