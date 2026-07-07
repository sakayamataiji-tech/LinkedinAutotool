import { PrismaClient, type ActionType, type LeadSource } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

async function main() {
  console.log("Seeding…");

  // Clean slate (dev only)
  await prisma.session.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.campaignLead.deleteMany();
  await prisma.campaignDailyStat.deleteMany();
  await prisma.sequenceNode.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.leadTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.accountConnection.deleteMany();
  await prisma.dailyLimit.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();

  const team = await prisma.team.create({
    data: { name: "Zeeta 営業チーム", timezone: "Asia/Tokyo" },
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const owner = await prisma.user.create({
    data: { email: "sakayama.taiji@zeeta.co.jp", name: "坂山 泰司", passwordHash },
  });
  await prisma.membership.create({
    data: { teamId: team.id, userId: owner.id, role: "OWNER" },
  });

  // A second member for the sales team (demonstrates multi-member operation).
  const member = await prisma.user.create({
    data: { email: "member@zeeta.co.jp", name: "佐藤 花子", passwordHash },
  });
  await prisma.membership.create({
    data: { teamId: team.id, userId: member.id, role: "MEMBER" },
  });

  // A second team the owner also belongs to (demonstrates team switching + tenant isolation).
  const recruitingTeam = await prisma.team.create({
    data: { name: "Zeeta 採用チーム", timezone: "Asia/Tokyo" },
  });
  await prisma.membership.create({
    data: { teamId: recruitingTeam.id, userId: owner.id, role: "OWNER" },
  });
  await prisma.dailyLimit.create({ data: { teamId: recruitingTeam.id } });

  await prisma.dailyLimit.create({
    data: {
      teamId: team.id,
      workingHours: [
        { enabled: true, start: "09:00", end: "18:00" }, // Mon
        { enabled: true, start: "09:00", end: "18:00" },
        { enabled: true, start: "09:00", end: "18:00" },
        { enabled: true, start: "09:00", end: "18:00" },
        { enabled: true, start: "09:00", end: "18:00" }, // Fri
        { enabled: false, start: "09:00", end: "18:00" },
        { enabled: false, start: "09:00", end: "18:00" },
      ],
    },
  });

  await prisma.accountConnection.createMany({
    data: [
      { teamId: team.id, type: "LINKEDIN", displayName: "坂山 泰司 (LinkedIn)", status: "connected" },
      { teamId: team.id, type: "SALES_NAVIGATOR", displayName: "Sales Navigator シート", status: "connected" },
      { teamId: team.id, type: "GMAIL", displayName: "sakayama.taiji@zeeta.co.jp", status: "connected" },
    ],
  });

  // Tags
  const tagNames = [
    { name: "ホット", color: "#ef4444" },
    { name: "SaaS", color: "#3282ff" },
    { name: "採用候補", color: "#10b981" },
    { name: "決裁者", color: "#8b5cf6" },
  ];
  const tags = [];
  for (const t of tagNames) {
    tags.push(await prisma.tag.create({ data: { teamId: team.id, ...t } }));
  }

  // Leads
  const sampleLeads: Array<{
    firstName: string;
    lastName: string;
    company: string;
    jobTitle: string;
    location: string;
    source: LeadSource;
    isConnected?: boolean;
    email?: string;
    isOpenProfile?: boolean;
  }> = [
    { firstName: "太郎", lastName: "田中", company: "Acme株式会社", jobTitle: "VP of Sales", location: "東京", source: "SALES_NAVIGATOR", isConnected: true, email: "taro.tanaka@acme.com" },
    { firstName: "花子", lastName: "鈴木", company: "Globex", jobTitle: "採用マネージャー", location: "大阪", source: "RECRUITER", isOpenProfile: true },
    { firstName: "James", lastName: "Carter", company: "Initech", jobTitle: "CTO", location: "San Francisco", source: "LINKEDIN_SEARCH", isConnected: true },
    { firstName: "美咲", lastName: "佐藤", company: "Umbrella Inc", jobTitle: "マーケティング部長", location: "名古屋", source: "POST_LIKERS" },
    { firstName: "Emma", lastName: "Wilson", company: "Hooli", jobTitle: "Head of People", location: "London", source: "EVENT_ATTENDEES", email: "emma.wilson@hooli.com" },
    { firstName: "健一", lastName: "山本", company: "Soylent", jobTitle: "事業開発", location: "福岡", source: "FIRST_CONNECTIONS", isConnected: true },
    { firstName: "Olivia", lastName: "Brown", company: "Vehement", jobTitle: "VP Engineering", location: "Berlin", source: "PROFILE_URL", isOpenProfile: true },
    { firstName: "翔太", lastName: "中村", company: "Massive Dynamic", jobTitle: "COO", location: "東京", source: "CSV_IMPORT" },
    { firstName: "Sophia", lastName: "Davis", company: "Stark Industries", jobTitle: "Recruiting Lead", location: "New York", source: "RECRUITER" },
    { firstName: "美穂", lastName: "小林", company: "Wayne Enterprises", jobTitle: "人事責任者", location: "横浜", source: "POST_COMMENTERS", email: "miho.kobayashi@wayne.com" },
    { firstName: "Liam", lastName: "Martin", company: "Cyberdyne", jobTitle: "Product Lead", location: "Toronto", source: "LINKEDIN_SEARCH" },
    { firstName: "陽菜", lastName: "加藤", company: "Tyrell Corp", jobTitle: "営業企画", location: "京都", source: "SALES_NAVIGATOR", isConnected: true },
  ];

  const leads = [];
  for (let i = 0; i < sampleLeads.length; i++) {
    const s = sampleLeads[i];
    const lead = await prisma.lead.create({
      data: {
        teamId: team.id,
        firstName: s.firstName,
        lastName: s.lastName,
        company: s.company,
        jobTitle: s.jobTitle,
        location: s.location,
        headline: `${s.jobTitle} @ ${s.company}`,
        profileUrl: `https://www.linkedin.com/in/${s.firstName.toLowerCase()}-${s.lastName.toLowerCase()}`,
        source: s.source,
        isConnected: s.isConnected ?? false,
        isOpenProfile: s.isOpenProfile ?? false,
        email: s.email ?? null,
        emailStatus: s.email ? "found" : "unknown",
      },
    });
    // assign a couple of tags
    if (i % 3 === 0) await prisma.leadTag.create({ data: { leadId: lead.id, tagId: tags[0].id } });
    if (i % 2 === 0) await prisma.leadTag.create({ data: { leadId: lead.id, tagId: tags[1].id } });
    if (s.source === "RECRUITER") await prisma.leadTag.create({ data: { leadId: lead.id, tagId: tags[2].id } });
    leads.push(lead);
  }

  // Sequence: 未接続→接続リクエスト→待機→(接続済み?)→メッセージ→待機→フォローアップ
  const sequence = await prisma.sequence.create({
    data: {
      teamId: team.id,
      name: "標準アウトリーチ（接続→メッセージ→フォローアップ）",
      description: "未接続の相手に接続リクエストを送り、承認後にメッセージ、未返信なら追加フォロー",
    },
  });

  const nodeDefs: Array<{
    kind: "ACTION" | "DELAY" | "CONDITION";
    actionType?: ActionType;
    messageBody?: string;
    delayMinutes?: number;
    conditionType?: "IS_CONNECTED" | "MESSAGE_SEEN" | "HAS_EMAIL" | "IS_OPEN_PROFILE";
  }> = [
    { kind: "ACTION", actionType: "VIEW_PROFILE" },
    { kind: "ACTION", actionType: "CONNECT_REQUEST" },
    { kind: "DELAY", delayMinutes: 2 * 24 * 60 },
    { kind: "CONDITION", conditionType: "IS_CONNECTED" },
    {
      kind: "ACTION",
      actionType: "MESSAGE",
      messageBody:
        "{{firstName}} さん、接続ありがとうございます！{{company}} での {{jobTitle}} のお取り組みに関心があり連絡しました。少しお話しできればと思います。",
    },
    { kind: "DELAY", delayMinutes: 3 * 24 * 60 },
    {
      kind: "ACTION",
      actionType: "MESSAGE",
      messageBody: "{{firstName}} さん、先日のメッセージのフォローアップです。ご都合いかがでしょうか？",
    },
  ];

  for (let i = 0; i < nodeDefs.length; i++) {
    const d = nodeDefs[i];
    await prisma.sequenceNode.create({
      data: {
        sequenceId: sequence.id,
        kind: d.kind,
        order: i,
        posY: i * 90,
        actionType: d.actionType ?? null,
        messageBody: d.messageBody ?? null,
        delayMinutes: d.delayMinutes ?? null,
        conditionType: d.conditionType ?? null,
      },
    });
  }

  // Template sequence
  await prisma.sequence.create({
    data: {
      teamId: team.id,
      name: "採用スカウト（InMail）テンプレート",
      description: "オープンプロフィール判定→InMail→メール検索→メール送信",
      isTemplate: true,
    },
  });

  // Campaign with leads
  const campaign = await prisma.campaign.create({
    data: {
      teamId: team.id,
      name: "Q3 新規開拓キャンペーン",
      description: "SaaS 決裁者向けアウトリーチ",
      status: "RUNNING",
      sequenceId: sequence.id,
    },
  });

  for (const lead of leads.slice(0, 10)) {
    await prisma.campaignLead.create({
      data: { campaignId: campaign.id, leadId: lead.id, status: "PENDING" },
    });
  }

  // A sample inbound conversation for the inbox
  const conv = await prisma.conversation.create({
    data: {
      id: `${leads[0].id}-linkedin`,
      leadId: leads[0].id,
      channel: "linkedin",
      unread: true,
      important: true,
    },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conv.id, direction: "OUTBOUND", body: "田中さん、接続ありがとうございます！", seen: true },
      { conversationId: conv.id, direction: "INBOUND", body: "こちらこそありがとうございます。ぜひ詳しく伺いたいです。" },
    ],
  });

  await prisma.webhook.create({
    data: {
      teamId: team.id,
      url: "https://hooks.example.com/linkedin",
      events: ["connection.accepted", "message.replied"],
    },
  });

  console.log(
    `Seeded: teams=[${team.name}, ${recruitingTeam.name}], leads=${leads.length}, sequence nodes=${nodeDefs.length}, campaign=${campaign.name}`,
  );
  console.log(`Demo login: ${owner.email} / ${DEMO_PASSWORD}  (also ${member.email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
