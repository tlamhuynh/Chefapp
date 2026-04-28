import { db, collection, addDoc, serverTimestamp, auth, writeBatch, doc } from './firebase';

export const SEED_DATA = {
  inventory: [
    { name: "Cá hồi Na Uy", amount: 5, unit: "kg", cost: 450000, category: "Hải sản", minThreshold: 2 },
    { name: "Sườn bò Mỹ", amount: 10, unit: "kg", cost: 650000, category: "Thịt", minThreshold: 3 },
    { name: "Nấm Truffle đen", amount: 200, unit: "g", cost: 1200000, category: "Gia vị cao cấp", minThreshold: 50 },
    { name: "Rượu vang đỏ Bordeaux", amount: 12, unit: "chai", cost: 850000, category: "Đồ uống", minThreshold: 4 },
    { name: "Kem tươi Anchor", amount: 5, unit: "lít", cost: 185000, category: "Sữa & Phô mai", minThreshold: 1 }
  ],
  recipes: [
    {
      title: "Cá Hồi Áp Chảo Sốt Chanh Leo",
      description: "Cá hồi giòn da phối cùng sốt chanh leo chua ngọt, trang trí với măng tây.",
      theme: "Âu-Á",
      difficulty: "medium",
      prepTime: 15,
      cookTime: 10,
      servings: 2,
      totalCost: 185000,
      sellingPrice: 450000,
      ingredients: [
        { name: "Cá hồi", amount: 300, unit: "g", cost: 135000 },
        { name: "Chanh leo", amount: 2, unit: "quả", cost: 10000 },
        { name: "Măng tây", amount: 100, unit: "g", cost: 25000 },
        { name: "Bơ lạt", amount: 20, unit: "g", cost: 15000 }
      ],
      steps: [
        "Làm sạch cá hồi, thấm khô da.",
        "Áp chảo mặt da 3 phút cho giòn, sau đó lật mặt thêm 2 phút.",
        "Nấu sốt chanh leo với bơ và mật ong thành hỗn hợp sệt.",
        "Bày trí ra đĩa và rưới sốt."
      ]
    },
    {
      title: "Sườn Bò Hầm Rượu Vang Đỏ",
      description: "Sườn bò hầm mềm trong 4 tiếng với rượu vang đỏ và các loại rau củ.",
      theme: "Pháp",
      difficulty: "hard",
      prepTime: 30,
      cookTime: 240,
      servings: 4,
      totalCost: 550000,
      sellingPrice: 1200000,
      ingredients: [
        { name: "Sườn bò", amount: 1, unit: "kg", cost: 450000 },
        { name: "Rượu vang đỏ", amount: 500, unit: "ml", cost: 80000 },
        { name: "Hành tây", amount: 1, unit: "củ", cost: 5000 },
        { name: "Cà rốt", amount: 1, unit: "củ", cost: 5000 },
        { name: "Lá quế/Xạ hương", amount: 10, unit: "g", cost: 10000 }
      ],
      steps: [
        "Ướp sườn với muối, tiêu và rượu vang.",
        "Xào sơ rau củ cho thơm.",
        "Cho tất cả vào nồi hầm ở lửa nhỏ hoặc lò nướng 160 độ C trong 4 tiếng.",
        "Sốt hầm ép lại thành glacé bóng mượt."
      ]
    }
  ],
  orders: [
    {
      table: "Table 05",
      items: [
        { name: "Cá hồi áp chảo", price: 450000, quantity: 1 },
        { name: "Vang đỏ Glass", price: 180000, quantity: 2 }
      ],
      total: 810000,
      status: "pending"
    },
    {
      table: "Vip 01",
      items: [
        { name: "Sườn bò hầm", price: 1200000, quantity: 2 },
        { name: "Moët & Chandon", price: 2500000, quantity: 1 }
      ],
      total: 4900000,
      status: "cooking"
    }
  ]
};

export async function seedProfessionalData() {
  if (!auth.currentUser) throw new Error("Bạn cần đăng nhập để tạo dữ liệu.");
  const uid = auth.currentUser.uid;
  const batch = writeBatch(db);

  // Seed Inventory
  for (const item of SEED_DATA.inventory) {
    const invRef = doc(collection(db, 'inventory'));
    batch.set(invRef, {
      ...item,
      authorId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Seed Recipes
  for (const recipe of SEED_DATA.recipes) {
    const recipeRef = doc(collection(db, 'recipes'));
    batch.set(recipeRef, {
      ...recipe,
      authorId: uid,
      createdAt: serverTimestamp()
    });
  }

  // Seed Orders
  for (const order of SEED_DATA.orders) {
    const orderRef = doc(collection(db, 'orders'));
    batch.set(orderRef, {
      ...order,
      authorId: uid,
      createdAt: serverTimestamp(),
      customerId: "sample-customer",
      timestamp: serverTimestamp()
    });
  }

  // Seed some chat history too
  const chatRef = doc(collection(db, 'chats'));
  batch.set(chatRef, {
    userId: uid,
    message: "Tôi vừa nạp dữ liệu mẫu cho nhà hàng của bạn. Bạn muốn tôi phân tích Menu này không?",
    sender: "ai",
    timestamp: serverTimestamp(),
    conversationId: "sample-conv"
  });

  await batch.commit();
}
