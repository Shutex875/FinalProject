BEGIN;

-- Stop backend writes during deployment. Release the reservations made by the
-- previous cart implementation exactly once; new carts do not reserve stock.
-- Abort rather than silently repair corrupt inventory.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CartItem" WHERE "quantity" < 1 OR "quantity" > 99)
     OR EXISTS (SELECT 1 FROM "Product" WHERE "stock" < 0) THEN
    RAISE EXCEPTION 'Invalid legacy inventory; reconcile before migration';
  END IF;
END $$;

UPDATE "Product" AS p
SET "stock" = p."stock" + reserved.quantity
FROM (SELECT "productId", SUM("quantity")::integer AS quantity
      FROM "CartItem" GROUP BY "productId") AS reserved
WHERE p.id = reserved."productId";

ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_range" CHECK ("quantity" BETWEEN 1 AND 99);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);

COMMIT;
