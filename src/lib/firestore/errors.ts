export class InsufficientStockError extends Error {
  productTitle: string;

  constructor(productTitle: string) {
    super(`${productTitle} no longer has enough stock for this order.`);
    this.name = "InsufficientStockError";
    this.productTitle = productTitle;
  }
}

export class InsufficientWalletBalanceError extends Error {
  constructor() {
    super("Wallet balance is not sufficient for this order.");
    this.name = "InsufficientWalletBalanceError";
  }
}
