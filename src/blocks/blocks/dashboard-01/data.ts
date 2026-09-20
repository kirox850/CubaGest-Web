// Datos de demostración de la data-table (equivalente al data.json del
// bloque original de shadcn — es un sandbox, se esperan datos falsos).
export type Payment = {
  id: number;
  header: string;
  type: string;
  status: string;
  email: string;
  target: string;
  limit: string;
  reviewer: string;
};

export const payments: Payment[] = [
  { id: 1, header: "Cover page", type: "Cover Page", status: "In Process", email: "michael.mitc@example.com", target: "45,000", limit: "50,000", reviewer: "Eddie Lake" },
  { id: 2, header: "Table of contents", type: "Table of Contents", status: "Done", email: "n.mitchell@example.com", target: "12,000", limit: "15,000", reviewer: "Jamik Tashpulatov" },
  { id: 3, header: "Executive summary", type: "Narrative", status: "Done", email: "sofia.j@example.com", target: "8,500", limit: "10,000", reviewer: "Eddie Lake" },
  { id: 4, header: "Technical approach", type: "Technical Approach", status: "In Process", email: "liam.b@example.com", target: "21,000", limit: "25,000", reviewer: "Emily Whalen" },
  { id: 5, header: "Design document", type: "Design", status: "Done", email: "ava.r@example.com", target: "16,000", limit: "20,000", reviewer: "Jamik Tashpulatov" },
  { id: 6, header: "Capabilities deck", type: "Focus Documents", status: "In Process", email: "noah.k@example.com", target: "30,000", limit: "35,000", reviewer: "Eddie Lake" },
  { id: 7, header: "Budget breakdown", type: "Focus Documents", status: "Done", email: "emma.w@example.com", target: "18,500", limit: "22,000", reviewer: "Emily Whalen" },
  { id: 8, header: "Risk assessment", type: "Narrative", status: "Not Started", email: "oliver.t@example.com", target: "9,000", limit: "12,000", reviewer: "Assign reviewer" },
  { id: 9, header: "Implementation plan", type: "Technical Approach", status: "In Process", email: "mia.l@example.com", target: "25,000", limit: "30,000", reviewer: "Jamik Tashpulatov" },
  { id: 10, header: "Quality assurance", type: "Focus Documents", status: "Done", email: "lucas.p@example.com", target: "14,000", limit: "16,000", reviewer: "Eddie Lake" },
  { id: 11, header: "Maintenance schedule", type: "Table of Contents", status: "In Process", email: "isabella.f@example.com", target: "11,000", limit: "13,000", reviewer: "Emily Whalen" },
  { id: 12, header: "Compliance report", type: "Narrative", status: "Done", email: "ethan.h@example.com", target: "19,500", limit: "24,000", reviewer: "Jamik Tashpulatov" },
  { id: 13, header: "Market analysis", type: "Narrative", status: "Not Started", email: "charlotte.s@example.com", target: "22,000", limit: "28,000", reviewer: "Assign reviewer" },
  { id: 14, header: "Competitor review", type: "Focus Documents", status: "In Process", email: "amelia.d@example.com", target: "13,500", limit: "15,000", reviewer: "Eddie Lake" },
  { id: 15, header: "Pricing strategy", type: "Focus Documents", status: "Done", email: "mason.j@example.com", target: "17,000", limit: "20,000", reviewer: "Emily Whalen" },
  { id: 16, header: "Executive bios", type: "Key Personnel", status: "In Process", email: "harper.m@example.com", target: "6,500", limit: "8,000", reviewer: "Jamik Tashpulatov" },
  { id: 17, header: "Org chart", type: "Key Personnel", status: "Done", email: "evelyn.c@example.com", target: "5,000", limit: "6,000", reviewer: "Eddie Lake" },
  { id: 18, header: "Past performance", type: "Past Performance", status: "In Process", email: "alex.j@example.com", target: "28,000", limit: "32,000", reviewer: "Emily Whalen" },
  { id: 19, header: "Client references", type: "Past Performance", status: "Done", email: "abigail.g@example.com", target: "10,000", limit: "12,000", reviewer: "Jamik Tashpulatov" },
  { id: 20, header: "Case studies", type: "Past Performance", status: "Not Started", email: "daniel.v@example.com", target: "15,500", limit: "18,000", reviewer: "Assign reviewer" },
  { id: 21, header: "Security plan", type: "Technical Approach", status: "In Process", email: "sofia.n@example.com", target: "20,000", limit: "25,000", reviewer: "Eddie Lake" },
  { id: 22, header: "Data governance", type: "Technical Approach", status: "Done", email: "henry.w@example.com", target: "12,500", limit: "14,000", reviewer: "Emily Whalen" },
  { id: 23, header: "Glossary", type: "Table of Contents", status: "Done", email: "luna.b@example.com", target: "3,000", limit: "4,000", reviewer: "Jamik Tashpulatov" },
  { id: 24, header: "Appendix A", type: "Focus Documents", status: "In Process", email: "benjamin.l@example.com", target: "8,000", limit: "9,000", reviewer: "Eddie Lake" },
  { id: 25, header: "Appendix B", type: "Focus Documents", status: "Not Started", email: "grace.k@example.com", target: "7,500", limit: "9,000", reviewer: "Assign reviewer" },
  { id: 26, header: "Acronyms list", type: "Table of Contents", status: "Done", email: "samuel.o@example.com", target: "2,500", limit: "3,000", reviewer: "Emily Whalen" },
  { id: 27, header: "Revision history", type: "Table of Contents", status: "Done", email: "victoria.e@example.com", target: "2,000", limit: "3,000", reviewer: "Jamik Tashpulatov" },
  { id: 28, header: "Approval matrix", type: "Focus Documents", status: "In Process", email: "theo.r@example.com", target: "6,000", limit: "7,000", reviewer: "Eddie Lake" },
  { id: 29, header: "Distribution list", type: "Table of Contents", status: "Not Started", email: "scarlett.y@example.com", target: "1,500", limit: "2,000", reviewer: "Assign reviewer" },
  { id: 30, header: "Contact directory", type: "Key Personnel", status: "In Process", email: "jack.d@example.com", target: "4,500", limit: "5,000", reviewer: "Emily Whalen" },
  { id: 31, header: "Facility photos", type: "Past Performance", status: "Done", email: "chloe.a@example.com", target: "9,500", limit: "11,000", reviewer: "Jamik Tashpulatov" },
  { id: 32, header: "Equipment specs", type: "Technical Approach", status: "In Process", email: "owen.m@example.com", target: "16,500", limit: "19,000", reviewer: "Eddie Lake" },
  { id: 33, header: "Software architecture", type: "Technical Approach", status: "Done", email: "aria.z@example.com", target: "23,000", limit: "26,000", reviewer: "Emily Whalen" },
  { id: 34, header: "API documentation", type: "Technical Approach", status: "In Process", email: "wyatt.f@example.com", target: "18,000", limit: "21,000", reviewer: "Jamik Tashpulatov" },
  { id: 35, header: "Testing protocol", type: "Focus Documents", status: "Not Started", email: "zoey.t@example.com", target: "11,500", limit: "13,000", reviewer: "Assign reviewer" },
  { id: 36, header: "Training materials", type: "Focus Documents", status: "In Process", email: "julian.p@example.com", target: "13,000", limit: "15,000", reviewer: "Eddie Lake" },
  { id: 37, header: "User guides", type: "Focus Documents", status: "Done", email: "stella.q@example.com", target: "14,500", limit: "16,000", reviewer: "Emily Whalen" },
  { id: 38, header: "Warranty terms", type: "Narrative", status: "In Process", email: "aaron.g@example.com", target: "5,500", limit: "7,000", reviewer: "Jamik Tashpulatov" },
  { id: 39, header: "Service levels", type: "Narrative", status: "Done", email: "penelope.h@example.com", target: "8,500", limit: "10,000", reviewer: "Eddie Lake" },
  { id: 40, header: "Escrow details", type: "Focus Documents", status: "Not Started", email: "eli.j@example.com", target: "7,000", limit: "8,000", reviewer: "Assign reviewer" },
  { id: 41, header: "Insurance certs", type: "Focus Documents", status: "In Process", email: "riley.w@example.com", target: "4,000", limit: "5,000", reviewer: "Emily Whalen" },
  { id: 42, header: "Licenses", type: "Focus Documents", status: "Done", email: "nora.b@example.com", target: "3,500", limit: "4,500", reviewer: "Jamik Tashpulatov" },
  { id: 43, header: "Patents list", type: "Narrative", status: "In Process", email: "carter.n@example.com", target: "6,500", limit: "8,000", reviewer: "Eddie Lake" },
  { id: 44, header: "Trademark info", type: "Narrative", status: "Done", email: "hailey.s@example.com", target: "3,000", limit: "4,000", reviewer: "Emily Whalen" },
  { id: 45, header: "Final signature page", type: "Cover Page", status: "In Process", email: "miles.c@example.com", target: "1,000", limit: "1,500", reviewer: "Jamik Tashpulatov" },
];
