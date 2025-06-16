// server.js - VERSÃO FINAL E CORRIGIDA

require("dotenv").config(); // Carrega as variáveis do arquivo .env

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs"); // Usando bcryptjs para maior compatibilidade
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");

// Importar os Models
const User = require("./models/user.model");
const Product = require("./models/product.model");
const Order = require("./models/order.model");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "seu-segredo-super-secreto";

// CONEXÃO COM O MONGODB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Conectado ao MongoDB..."))
  .catch((err) =>
    console.error("Não foi possível conectar ao MongoDB...", err)
  );

// CONFIGURAÇÃO DO MULTER
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage: storage });

//  ROTAS DA API

// Rota de Registro
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res
        .status(409)
        .json({ message: "Este email já está registrado." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "Usuário registrado com sucesso!" });
  } catch (error) {
    console.error("ERRO NO REGISTRO:", error);
    res.status(500).json({
      message: "Erro no servidor ao registrar.",
      error: error.message,
    });
  }
});

// Rota de Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Email ou senha inválidos." });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).json({
      message: "Login realizado com sucesso!",
      token,
      user: { name: user.name },
    });
  } catch (error) {
    console.error("ERRO NO LOGIN:", error);
    res.status(500).json({ message: "Erro no servidor ao fazer login." });
  }
});

// Rota para ADICIONAR um novo produto COM IMAGEM
app.post("/api/products", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).send("Nenhum arquivo de imagem foi enviado.");

    const product = new Product({
      title: req.body.title,
      price: parseFloat(req.body.price),
      description: req.body.description,
      image: `/uploads/${req.file.filename}`,
    });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error("ERRO AO CRIAR PRODUTO:", error);
    res
      .status(500)
      .json({ message: "Erro ao criar produto.", error: error.message });
  }
});

// Rota para buscar todos os produtos
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    console.error("ERRO DETALHADO AO BUSCAR PRODUTOS:", error);
    res.status(500).json({ message: "Erro ao buscar produtos." });
  }
});

// MIDDLEWARE DE AUTENTICAÇÃO
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    return res.status(401).json({ message: "Token não fornecido." });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado." });
    }
    req.userId = payload.userId;
    next();
  });
};

// ROTAS PROTEGIDAS

// Rota para buscar informações do perfil
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user)
      return res.status(404).json({ message: "Usuário não encontrado." });
    res.json(user);
  } catch (error) {
    console.error("ERRO AO BUSCAR PERFIL:", error);
    res.status(500).json({ message: "Erro ao buscar perfil." });
  }
});
// Rota para buscar os pedidos do usuário (A ROTA QUE FALTAVA)
app.get("/api/orders", authenticateToken, async (req, res) => {
  try {
    // Busca no banco de dados todos os pedidos que pertencem ao usuário logado
    const userOrders = await Order.find({ userId: req.userId }).sort({
      date: -1,
    });
    res.status(200).json(userOrders);
  } catch (error) {
    console.error("ERRO AO BUSCAR PEDIDOS:", error);
    res.status(500).json({ message: "Erro ao buscar pedidos do usuário." });
  }
});
// Rota para criar um novo pedido
app.post("/api/orders", authenticateToken, async (req, res) => {
  try {
    const { items, total } = req.body;
    if (!items || !total)
      return res.status(400).json({ message: "Dados do pedido incompletos." });

    const order = new Order({
      userId: req.userId,
      items: items.map((item) => `${item.title} (x${item.quantity})`),
      total: total,
    });
    await order.save();
    res.status(201).json({ message: "Pedido realizado com sucesso!", order });
  } catch (error) {
    //estava com um erro muito chato de resolver em que os pedidos sumiam, deixei essa parte para esclarecimento
    console.error("ERRO DETALHADO AO CRIAR PEDIDO:", error);
    res.status(500).json({ message: "Erro ao criar pedido." });
  }
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
