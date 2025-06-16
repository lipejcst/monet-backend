const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, default: "Processando" },
  items: [{ type: String }],
  total: { type: Number, required: true },
});

module.exports = mongoose.model("Order", orderSchema);
