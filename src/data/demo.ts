import type { Category, Leader, Poll } from "../types";

export const CATEGORY_LABELS: Record<Category, string> = {
  technology: "Teknoloji",
  gaming: "Oyun",
  science: "Bilim",
  "current-affairs": "Gündem",
  society: "Toplum",
  education: "Eğitim",
  sports: "Spor",
  entertainment: "Eğlence",
  philosophy: "Felsefe",
  "everyday-life": "Günlük hayat",
};

export const DEMO_POLLS: Poll[] = [
  {
    id: "ai-classroom",
    question:
      "Yapay zekâ ödevlerde yardımcı mı, yoksa öğrenmenin önünde bir kestirme mi?",
    description: "Sence okulda üretken yapay zekânın yeri nasıl olmalı?",
    category: "technology",
    author: "Derya Yılmaz",
    username: "derya",
    createdAt: "12 dk önce",
    comments: 24,
    featured: true,
    options: [
      {
        id: "helper",
        label: "Doğru kullanılırsa güçlü bir yardımcı",
        votes: 182,
      },
      { id: "shortcut", label: "Öğrenme sürecini zayıflatıyor", votes: 134 },
      { id: "depends", label: "Derse ve kullanım amacına bağlı", votes: 96 },
    ],
  },
  {
    id: "single-player",
    question: "Bir oyunu tekrar tekrar açtıran şey sence ne?",
    description: "Bir sonraki oyununu seçerken neye bakarsın?",
    category: "gaming",
    author: "Mert Kaya",
    username: "mertoyunda",
    createdAt: "28 dk önce",
    comments: 18,
    options: [
      { id: "story", label: "İyi yazılmış bir hikâye", votes: 67 },
      { id: "gameplay", label: "Akıcı ve derin oynanış", votes: 123 },
      { id: "people", label: "Birlikte oynadığım insanlar", votes: 88 },
    ],
  },
  {
    id: "space-discovery",
    question:
      "Uzay araştırmalarında öncelik insanlı görevler mi, robotlar mı olmalı?",
    description: "Kaynaklar sınırlıyken hangisi daha çok şey kazandırır?",
    category: "science",
    author: "Selin Arı",
    username: "selinarastiriyor",
    createdAt: "43 dk önce",
    comments: 31,
    options: [
      { id: "human", label: "İnsanlı görevler", votes: 72 },
      { id: "robot", label: "Robotik keşif araçları", votes: 146 },
      { id: "both", label: "İkisi birlikte ilerlemeli", votes: 111 },
    ],
  },
  {
    id: "news-break",
    question: "Gündemi takip etmek için sosyal medya tek başına yeterli mi?",
    description: "Bilgiye ulaşma alışkanlığımız değişiyor.",
    category: "current-affairs",
    author: "Ece Demir",
    username: "eceninnotlari",
    createdAt: "1 sa önce",
    comments: 42,
    options: [
      { id: "yes", label: "Evet, doğru hesapları izlemek yeterli", votes: 54 },
      {
        id: "no",
        label: "Hayır, farklı kaynakları karşılaştırmak gerekir",
        votes: 201,
      },
      { id: "sometimes", label: "Konuya göre değişir", votes: 132 },
    ],
  },
  {
    id: "city-life",
    question: "İyi bir şehirde en önce ne olmalı?",
    description:
      "Şehrin yaşam kalitesini belirleyen en önemli şey sence hangisi?",
    category: "society",
    author: "Baran Öztürk",
    username: "baran",
    createdAt: "2 sa önce",
    comments: 36,
    options: [
      { id: "transit", label: "Güvenilir toplu taşıma", votes: 178 },
      { id: "green", label: "Yeşil ve kamusal alanlar", votes: 137 },
      { id: "culture", label: "Kültür ve komşuluk hayatı", votes: 81 },
    ],
  },
  {
    id: "learning-path",
    question: "Bir beceriyi öğrenirken en etkili yöntem hangisi?",
    description: "Kendi deneyiminde hangisi daha çok işe yarıyor?",
    category: "education",
    author: "İpek Aydın",
    username: "ipekleogren",
    createdAt: "3 sa önce",
    comments: 29,
    options: [
      { id: "practice", label: "Yaparak ve deneyerek", votes: 205 },
      { id: "reading", label: "Okuyup izleyerek", votes: 72 },
      { id: "mentor", label: "Birinden geri bildirim alarak", votes: 114 },
    ],
  },
  {
    id: "sports-fans",
    question: "Sporda başarıyı en çok ne belirler?",
    description: "Bir takımın sezonunu sence ne değiştirir?",
    category: "sports",
    author: "Can Yıldız",
    username: "canyazar",
    createdAt: "4 sa önce",
    comments: 15,
    options: [
      { id: "talent", label: "Oyuncu kalitesi", votes: 91 },
      { id: "teamwork", label: "Takım uyumu", votes: 133 },
      { id: "coach", label: "Doğru teknik ekip", votes: 109 },
    ],
  },
  {
    id: "film-ending",
    question: "Bir filmde açık uçlu final mi, net bir son mu tercih edersin?",
    description:
      "Film bittikten sonra düşünmeye devam etmek mi, her şeyin yerine oturması mı?",
    category: "entertainment",
    author: "Sude Akın",
    username: "sudeizliyor",
    createdAt: "5 sa önce",
    comments: 57,
    options: [
      { id: "open", label: "Yorumlamaya açık final", votes: 122 },
      { id: "clear", label: "Net ve tamamlanmış final", votes: 97 },
      { id: "story", label: "Hikâye hangisini gerektiriyorsa", votes: 76 },
    ],
  },
  {
    id: "good-life",
    question: "İyi bir hayatı daha çok huzur mu, heyecan mı tanımlar?",
    description: "İkisi arasında seçim yapmak zorunda olsaydın?",
    category: "philosophy",
    author: "Emre Şen",
    username: "emresoruyor",
    createdAt: "6 sa önce",
    comments: 64,
    options: [
      { id: "calm", label: "Huzur ve istikrar", votes: 143 },
      { id: "adventure", label: "Heyecan ve yenilik", votes: 89 },
      { id: "balance", label: "İkisi arasında denge", votes: 171 },
    ],
  },
  {
    id: "morning-routine",
    question: "Sabah erken başlamak mı, geç başlayıp akşam uzatmak mı?",
    description: "Gün içinde enerjin en çok hangi saatlerde?",
    category: "everyday-life",
    author: "Nazlı Eren",
    username: "nazlidan",
    createdAt: "7 sa önce",
    comments: 22,
    options: [
      { id: "early", label: "Erken başlamak", votes: 116 },
      { id: "late", label: "Geç başlayıp akşam çalışmak", votes: 88 },
      { id: "flexible", label: "Sabit saat değil, esneklik", votes: 153 },
    ],
  },
];

export const DEMO_LEADERS: Leader[] = [
  {
    username: "selinarastiriyor",
    displayName: "Selin Arı",
    points: 482,
    initials: "SA",
  },
  {
    username: "eceninnotlari",
    displayName: "Ece Demir",
    points: 431,
    initials: "ED",
  },
  {
    username: "baran",
    displayName: "Baran Öztürk",
    points: 397,
    initials: "BÖ",
  },
  {
    username: "ipekleogren",
    displayName: "İpek Aydın",
    points: 358,
    initials: "İA",
  },
  {
    username: "mertoyunda",
    displayName: "Mert Kaya",
    points: 332,
    initials: "MK",
  },
];

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as Category[];
