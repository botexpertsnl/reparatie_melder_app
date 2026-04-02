export const demoTenant = {
  name: "Velocity Garage",
  terminology: {
    customer: "Customer",
    asset: "Car",
    workItem: "Repair"
  }
};

export const demoCustomers = [
  { id: "cus_1", fullName: "Alex Jansen", phone: "+31 6 1234 5678", email: "alex@example.com" },
  { id: "cus_2", fullName: "Noor Visser", phone: "+31 6 2323 1111", email: "noor@example.com" },
  { id: "cus_3", fullName: "Milan de Wit", phone: "+31 6 9876 5432", email: "milan@example.com" }
];

export const demoAssets = [
  { id: "asset_1", customerId: "cus_1", type: "Car", displayName: "Volkswagen Golf", identifier: "XX-123-Z" },
  { id: "asset_2", customerId: "cus_2", type: "Car", displayName: "Tesla Model 3", identifier: "EV-778-K" },
  { id: "asset_3", customerId: "cus_3", type: "Car", displayName: "Renault Clio", identifier: "AB-987-C" }
];

export const demoStages = [
  "New",
  "Scheduled",
  "In progress",
  "Waiting for customer approval",
  "Ready for pickup",
  "Completed"
];

export const demoWorkItems = [
  { id: "wi_1", title: "Brake inspection", customerId: "cus_1", assetId: "asset_1", stage: "In progress", priority: "High" },
  { id: "wi_2", title: "Battery check", customerId: "cus_2", assetId: "asset_2", stage: "Waiting for customer approval", priority: "Normal" },
  { id: "wi_3", title: "Annual service", customerId: "cus_3", assetId: "asset_3", stage: "Ready for pickup", priority: "Normal" }
];

export const demoThreads = [
  { id: "th_1", customerId: "cus_1", preview: "Your repair is in progress.", unread: 0, updatedAt: "10:12" },
  { id: "th_2", customerId: "cus_2", preview: "Can you approve extra work?", unread: 2, updatedAt: "09:44" },
  { id: "th_3", customerId: "cus_3", preview: "Ready for pickup after 16:00.", unread: 1, updatedAt: "08:21" }
];

export const demoTemplates = [
  { id: "tpl_1", name: "Stage update", category: "update", language: "en" },
  { id: "tpl_2", name: "Approval request", category: "approval", language: "en" },
  { id: "tpl_3", name: "Pickup ready", category: "pickup", language: "nl" }
];
