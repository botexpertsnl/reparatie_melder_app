import type { StoredConversation } from "@/lib/conversation-store";
import type { StoredRepair } from "@/lib/repair-store";

const DUMMY_CREATED_AT_BASE = "2026-03-01T08:00:00.000Z";

type DummyPerson = {
  firstName: string;
  lastName: string;
  phone: string;
};

const dummyPeople: DummyPerson[] = [
  { firstName: "Emma", lastName: "van Dijk", phone: "+31 611200101" },
  { firstName: "Lucas", lastName: "Bakker", phone: "+31 611200102" },
  { firstName: "Mila", lastName: "Smit", phone: "+31 611200103" },
  { firstName: "Noah", lastName: "de Boer", phone: "+31 611200104" },
  { firstName: "Lotte", lastName: "Mulder", phone: "+31 611200105" },
  { firstName: "Daan", lastName: "de Vries", phone: "+31 611200106" },
  { firstName: "Saar", lastName: "Bos", phone: "+31 611200107" },
  { firstName: "Finn", lastName: "Meijer", phone: "+31 611200108" },
  { firstName: "Nina", lastName: "van Leeuwen", phone: "+31 611200109" },
  { firstName: "Levi", lastName: "Vos", phone: "+31 611200110" },
  { firstName: "Yara", lastName: "de Groot", phone: "+31 611200111" },
  { firstName: "Mats", lastName: "Kuiper", phone: "+31 611200112" },
  { firstName: "Zoë", lastName: "Post", phone: "+31 611200113" },
  { firstName: "Timo", lastName: "Prins", phone: "+31 611200114" },
  { firstName: "Fenna", lastName: "Scholten", phone: "+31 611200115" },
  { firstName: "Sem", lastName: "Hendriks", phone: "+31 611200116" },
  { firstName: "Lynn", lastName: "Koster", phone: "+31 611200117" },
  { firstName: "Bram", lastName: "van Dam", phone: "+31 611200118" },
  { firstName: "Isis", lastName: "Dekker", phone: "+31 611200119" },
  { firstName: "Julian", lastName: "Willems", phone: "+31 611200120" },
  { firstName: "Evi", lastName: "Jongman", phone: "+31 611200121" },
  { firstName: "Noud", lastName: "Peeters", phone: "+31 611200122" },
  { firstName: "Romy", lastName: "Smits", phone: "+31 611200123" },
  { firstName: "Thijs", lastName: "van den Berg", phone: "+31 611200124" },
  { firstName: "Puck", lastName: "Verhoeven", phone: "+31 611200125" },
  { firstName: "Hugo", lastName: "de Graaf", phone: "+31 611200126" },
  { firstName: "Fleur", lastName: "Ruiter", phone: "+31 611200127" },
  { firstName: "Morris", lastName: "van Rijn", phone: "+31 611200128" },
  { firstName: "Lina", lastName: "Schipper", phone: "+31 611200129" },
  { firstName: "Olivier", lastName: "Kok", phone: "+31 611200130" }
];

const repairTitles = [
  ["Battery replacement", "iPhone 13 mini - battery health 73%"],
  ["Charging port repair", "Samsung Galaxy A54 - cable not detected"],
  ["Camera module swap", "iPhone 12 Pro - rear camera blur"],
  ["Back glass replacement", "Pixel 8 - shattered rear panel"],
  ["Speaker cleaning", "iPhone SE - muffled top speaker"],
  ["Motherboard diagnostics", "OnePlus 10 - random restarts"],
  ["Screen replacement", "iPad Air 4 - touch dead zone"],
  ["Button flex repair", "iPhone 11 - volume down unresponsive"],
  ["Water damage treatment", "Galaxy S22 - no boot after moisture"],
  ["Face ID diagnostics", "iPhone 14 - Face ID unavailable"],
  ["Microphone repair", "Pixel 7 - caller cannot hear"],
  ["USB-C board replacement", "Xiaomi 13 - charging only at angle"],
  ["Camera lens replacement", "iPhone 15 Pro - cracked lens ring"],
  ["Signal issue troubleshooting", "Galaxy Z Flip5 - unstable network"],
  ["Thermal paste refresh", "MacBook Air M1 - thermal throttling"],
  ["Trackpad cable replacement", "MacBook Pro 14 - intermittent click"],
  ["Fan cleaning", "Gaming laptop - loud fan under light load"],
  ["HDMI port replacement", "PlayStation 5 - no image output"],
  ["SSD upgrade install", "Desktop PC - migrate to NVMe 2TB"],
  ["RAM diagnostics", "Workstation - memory errors"],
  ["Keyboard replacement", "ThinkPad T14 - several keys sticking"],
  ["Data transfer", "Old Android to new iPhone setup"],
  ["Hinge repair", "Surface Laptop - loose display hinge"],
  ["Battery connector reseat", "Nintendo Switch - sudden shutdowns"],
  ["Charging IC replacement", "iPhone 12 - heats while charging"]
] as const;

const conversationPreviews = [
  "Hi, can I get an update on my device repair?",
  "Thanks for the quote. Please continue with the repair.",
  "Could you call me back after 17:30? I may miss WhatsApp messages during work.",
  "I can drop off the charger too if needed.",
  "Great service so far, thank you!",
  "Can you confirm if parts are in stock before you start?",
  "Please close this conversation, I picked it up already.",
  "I approve the extra work, go ahead.",
  "Any chance this can be finished before Friday afternoon?",
  "The issue came back after two days, what are the next steps?",
  "Could you share a rough ETA and total price incl. VAT?",
  "No rush, just keep me posted when the diagnostics are done.",
  "Is there warranty on the replaced screen?",
  "Long message test: I use this phone for two-factor authentication for banking and work portals, so I'd really appreciate frequent updates while it is in service.",
  "Short ping: update?",
  "I will be in your area tomorrow morning.",
  "Please use the black frame if available.",
  "Can you send a photo once the repair is complete?",
  "All good, thank you for the quick turnaround.",
  "I'm okay with a refurbished part if it lowers the price.",
  "Please keep this one open until I confirm pickup.",
  "Can you move this to next week?",
  "I need an invoice with company details.",
  "This is resolved now, thanks.",
  "Could you double-check battery calibration before closing?",
  "Is parking available near your shop?",
  "Very helpful support, appreciate it.",
  "Please unlink from previous repair, this is a different device.",
  "The phone number on file is still correct.",
  "Closing this case now."
] as const;

const repairStages = [
  "New",
  "New",
  "New",
  "New",
  "Scheduled",
  "Scheduled",
  "Scheduled",
  "In Progress",
  "In Progress",
  "In Progress",
  "In Progress",
  "Send offer",
  "Send offer",
  "Send offer",
  "Not Approved",
  "Not Approved",
  "Approved",
  "Approved",
  "Approved",
  "Ready for Pickup",
  "Ready for Pickup",
  "Completed",
  "Completed",
  "Cancelled",
  "Cancelled"
] as const;

const conversationTimes = [
  "23:58", "22:41", "21:09", "20:11", "19:37", "18:54", "17:46", "16:13", "15:29", "14:40",
  "13:55", "13:31", "12:44", "11:59", "11:23", "10:51", "10:22", "09:47", "09:18", "08:56",
  "08:20", "Yesterday", "Mon", "Sun", "Sat", "Fri", "Thu", "Wed", "Tue", "07:05"
] as const;

export const DUMMY_DATA_MARKER = "statusflow-dummy-seed-v1";

export const seededDummyRepairs: StoredRepair[] = Array.from({ length: 25 }, (_, index) => {
  const person = dummyPeople[index];
  const [title, subtitle] = repairTitles[index];
  const day = String((index % 28) + 1).padStart(2, "0");
  const createdAt = `2026-03-${day}T0${(index % 9) + 8}:15:00.000Z`;
  const updatedAt = `2026-04-${String((index % 12) + 1).padStart(2, "0")}T1${index % 10}:45:00.000Z`;

  return {
    id: `dummy_repair_${String(index + 1).padStart(2, "0")}`,
    title,
    subtitle,
    description: `${subtitle}. Internal note: seeded for UI testing (${DUMMY_DATA_MARKER}).`,
    customerName: `${person.firstName} ${person.lastName}`,
    customerFirstName: person.firstName,
    customerLastName: person.lastName,
    customerPhone: person.phone,
    assetName: subtitle.split(" - ")[0],
    stage: repairStages[index],
    priority: index % 5 === 0 ? "High" : index % 3 === 0 ? "Low" : "Medium",
    status: "Open",
    createdAt,
    updatedAt,
    isDummy: true,
    dummyTag: DUMMY_DATA_MARKER,
  };
});

export const seededDummyConversations: StoredConversation[] = Array.from({ length: 30 }, (_, index) => {
  const person = dummyPeople[index];
  const linkedRepair = index < 25 ? seededDummyRepairs[index] : undefined;
  const isOpen = index < 10;
  const preview = conversationPreviews[index];

  return {
    id: `dummy_thread_${String(index + 1).padStart(2, "0")}`,
    customerName: `${person.firstName} ${person.lastName}`,
    customerPhone: person.phone,
    preview,
    updatedAt: conversationTimes[index],
    open: isOpen,
    linkedRepairId: linkedRepair?.id,
    messages: [
      {
        id: `dummy_message_${String(index + 1).padStart(2, "0")}`,
        role: index % 4 === 0 ? "agent" : "customer",
        text: preview,
        at: conversationTimes[index],
      }
    ],
    isDummy: true,
    dummyTag: DUMMY_DATA_MARKER,
    createdAt: DUMMY_CREATED_AT_BASE,
  };
});
