/** Downloadable CSV template for lead import. */
export function GET() {
  const rows = [
    "name,company,jobTitle,location,email,profileUrl",
    'Dr. 山田 太郎 🎯,Acme株式会社,VP of Sales,東京,taro.yamada@acme.com,https://www.linkedin.com/in/taro-yamada',
    'Jane Doe, PhD,Globex,採用マネージャー,大阪,,https://www.linkedin.com/in/jane-doe',
    'John Smith,Initech,CTO,San Francisco,john.smith@initech.com,',
  ];
  return new Response("﻿" + rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads-template.csv"',
    },
  });
}
