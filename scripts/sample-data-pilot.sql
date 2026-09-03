-- ===========================================================================
-- Sample data for the two pilot stores, so every screen + report shows
-- realistic content. Idempotent-ish: it deletes prior rows tagged
-- note='SAMPLE' before re-inserting, so you can run it again safely.
--
--   Kavin Store    50000000-0000-0000-0000-000000000001   (kirana, NOT GST)
--   Lenin Mobiles  50000000-0000-0000-0000-000000000002   (LB Cards, GST 18/12)
--
-- Run AFTER round29..round34. Requires pgcrypto/gen_random_uuid (Neon has it).
-- Clients pick this up on their next sync (server synced_at > client cursor).
-- ===========================================================================

-- ---- wipe any earlier sample rows (tagged in `note`) --------------------------
DELETE FROM "store"."sales"             WHERE note = 'SAMPLE';
DELETE FROM "store"."stock_movements"   WHERE note = 'SAMPLE';
DELETE FROM "store"."purchases"         WHERE note = 'SAMPLE';
DELETE FROM "store"."supplier_payments" WHERE note = 'SAMPLE';
DELETE FROM "store"."receipts"          WHERE note = 'SAMPLE';
DELETE FROM "store"."expenses"          WHERE note = 'SAMPLE';
DELETE FROM "store"."orders"            WHERE note = 'SAMPLE';
DELETE FROM "store"."customers"         WHERE note = 'SAMPLE';
DELETE FROM "store"."suppliers"         WHERE note = 'SAMPLE';
DELETE FROM "store"."products"          WHERE hsn  = 'SAMPLE';

DO $$
DECLARE
  -- store id + whether it charges GST
  s          RECORD;
  now_ms     bigint := (extract(epoch FROM now()) * 1000)::bigint;
  d          int;                       -- day offset loop var
  -- product ids (10 per store)
  p          uuid[];
  pname      text[];
  pmrp       numeric[];
  pprice     numeric[];
  pcost      numeric[];
  pgst       numeric[];
  punit      text[];
  i          int;
  -- supplier / customer ids
  sup        uuid[];
  supname    text[];
  cus        uuid[];
  cusname    text[];
  cusopen    numeric[];
  -- helpers
  bill_seq   int;
  gstrate    numeric;
  taxable    numeric;
  taxamt     numeric;
BEGIN
FOR s IN
  SELECT id,
         (id = '50000000-0000-0000-0000-000000000002') AS gst
  FROM "store"."stores"
  WHERE id IN ('50000000-0000-0000-0000-000000000001',
               '50000000-0000-0000-0000-000000000002')
LOOP
  -- ---------------------------------------------------------------- products
  IF s.gst THEN
    pname  := ARRAY['Wedding Card Premium','Wedding Card Standard','Visiting Card 1000',
                    'Flex Banner (sqft)','Photo Frame A4','Screen Guard','Phone Cover',
                    'USB-C Cable','Pen Drive 32GB','Gift Wrap Roll'];
    pmrp   := ARRAY[45,25,600,18,180,120,199,150,450,60];
    pprice := ARRAY[40,22,550,15,160,99,180,130,420,50];
    pcost  := ARRAY[24,13,380,8,110,55,110,80,300,30];
    pgst   := ARRAY[12,12,18,18,12,18,18,18,18,12];
    punit  := ARRAY['piece','piece','box','piece','piece','piece','piece','piece','piece','piece'];
  ELSE
    pname  := ARRAY['Aashirvaad Atta 5kg','Sugar (loose kg)','Toor Dal (kg)','Sunflower Oil 1L',
                    'Amul Butter 500g','Colgate 150g','Surf Excel 1kg','Maggi 12-pack',
                    'Tea Powder 250g','Biscuit Pack'];
    pmrp   := ARRAY[285,0,0,145,275,99,140,168,150,30];
    pprice := ARRAY[280,45,130,140,270,95,135,160,145,28];
    pcost  := ARRAY[255,40,118,128,255,80,120,150,130,22];
    pgst   := ARRAY[0,0,0,0,0,0,0,0,0,0];
    punit  := ARRAY['packet','kg','kg','piece','piece','piece','packet','box','packet','packet'];
  END IF;

  p := ARRAY[]::uuid[];
  FOR i IN 1..10 LOOP
    p := p || gen_random_uuid();
    INSERT INTO "store"."products"
      (id, store_id, barcode, name, mrp, price, cost_price, stock_qty, unit,
       low_stock_threshold, expiry_date, gst_rate, hsn, updated_at, deleted_at, synced_at)
    VALUES
      (p[i], s.id, NULL, pname[i], pmrp[i], pprice[i], pcost[i],
       (40 + i * 7), punit[i], 5, NULL, pgst[i], 'SAMPLE', now_ms, NULL, now());
    -- opening-stock movement
    INSERT INTO "store"."stock_movements"
      (id, store_id, product_id, user_id, supplier_id, delta, reason, qty_after,
       unit_cost, note, created_at, synced_at)
    VALUES
      (gen_random_uuid(), s.id, p[i], NULL, NULL, (40 + i * 7), 'opening',
       (40 + i * 7), pcost[i], 'SAMPLE', now_ms - 30 * 86400000, now());
  END LOOP;

  -- --------------------------------------------------------------- suppliers
  IF s.gst THEN
    supname := ARRAY['Sri Paper Mart','Mobile World Distributors','LB Print Supplies'];
  ELSE
    supname := ARRAY['Metro Wholesale','Krishna Traders','Balaji Distributors'];
  END IF;
  sup := ARRAY[]::uuid[];
  FOR i IN 1..3 LOOP
    sup := sup || gen_random_uuid();
    INSERT INTO "store"."suppliers"
      (id, store_id, name, phone, note, updated_at, deleted_at, synced_at)
    VALUES (sup[i], s.id, supname[i], '90000' || (10000 + i)::text, 'SAMPLE',
            now_ms, NULL, now());
  END LOOP;

  -- --------------------------------------------------------------- customers
  IF s.gst THEN
    cusname := ARRAY['Ravi Traders','Selvi Wedding Hall','Kumar Photo Studio','Walk-in Regular'];
  ELSE
    cusname := ARRAY['Lakshmi (flat 3B)','Murugan Anna','Fathima Store','Ward member office'];
  END IF;
  cusopen := ARRAY[1200, 0, 450, 0];
  cus := ARRAY[]::uuid[];
  FOR i IN 1..4 LOOP
    cus := cus || gen_random_uuid();
    INSERT INTO "store"."customers"
      (id, store_id, name, phone, place, gstin, credit_limit, opening_balance,
       note, updated_at, deleted_at, synced_at)
    VALUES (cus[i], s.id, cusname[i], '98765' || (43000 + i)::text,
            CASE WHEN s.gst THEN 'Marthandam' ELSE 'Nagercoil' END,
            CASE WHEN s.gst AND i = 1 THEN '33ABCDE1234F1Z5' ELSE NULL END,
            CASE WHEN i <= 2 THEN 10000 ELSE 5000 END,
            cusopen[i], 'SAMPLE', now_ms, NULL, now());
  END LOOP;

  -- ------------------------------------------------------------------- sales
  -- 8 bills over the last 12 days: cash, upi, card, credit, split.
  bill_seq := 0;
  FOR d IN 0..7 LOOP
    bill_seq := bill_seq + 1;
    DECLARE
      bid      uuid := gen_random_uuid();
      created  bigint := now_ms - d * 86400000 - 3600000;
      pidx     int := 1 + (d % 10);
      qty      numeric := 1 + (d % 4);
      up       numeric := pprice[pidx];
      line     numeric := qty * up;
      tender   text := (ARRAY['cash','cash','upi','card','credit','cash','upi','split'])[d + 1];
      cust     uuid := CASE WHEN d IN (4, 7) THEN cus[1 + (d % 4)] ELSE NULL END;
      cashamt  numeric := 0;
      upiamt   numeric := 0;
      cardamt  numeric := 0;
      total    numeric;
      preround numeric := line;
      roundoff numeric;
      tbreak   jsonb := '[]'::jsonb;
      ttotal   numeric := 0;
    BEGIN
      IF s.gst AND pgst[pidx] > 0 THEN
        gstrate := pgst[pidx];
        taxable := round(preround / (1 + gstrate / 100), 2);
        taxamt  := round(preround - taxable, 2);
        ttotal  := taxamt;
        tbreak  := jsonb_build_array(jsonb_build_object(
                     'rate', gstrate, 'taxable', taxable,
                     'cgst', round(taxamt / 2, 2), 'sgst', round(taxamt / 2, 2)));
      END IF;
      total    := round(preround);              -- roundBills on
      roundoff := round((total - preround)::numeric, 2);

      IF tender = 'cash'  THEN cashamt := total;
      ELSIF tender = 'upi'  THEN upiamt := total;
      ELSIF tender = 'card' THEN cardamt := total;
      ELSIF tender = 'split' THEN upiamt := round(total / 2); cashamt := total - upiamt;
      END IF;  -- credit: all zero

      INSERT INTO "store"."sales"
        (id, store_id, user_id, bill_no, items, discount, tax_total, tax_breakup,
         roundoff, total, tender_type, customer_id, cash_amount, upi_amount,
         card_amount, salesman, note, created_at, updated_at, deleted_at, synced_at)
      VALUES
        (bid, s.id, NULL, 'SD-' || lpad(bill_seq::text, 4, '0'),
         jsonb_build_array(jsonb_build_object(
           'productId', p[pidx], 'name', pname[pidx], 'qty', qty, 'unit', punit[pidx],
           'unitPrice', up, 'discount', 0, 'discountPct', 0, 'gstRate',
           CASE WHEN s.gst THEN pgst[pidx] ELSE 0 END)),
         0, ttotal, tbreak, roundoff, total, tender, cust,
         cashamt, upiamt, cardamt,
         (ARRAY['COUNTER','Lenin','COUNTER','Ramesh','Lenin','COUNTER','Ramesh','Lenin'])[d + 1],
         'SAMPLE', created, created, NULL, now());

      -- stock-out movement for the sold line
      INSERT INTO "store"."stock_movements"
        (id, store_id, product_id, user_id, supplier_id, delta, reason, qty_after,
         unit_cost, note, created_at, synced_at)
      VALUES
        (gen_random_uuid(), s.id, p[pidx], NULL, NULL, -qty, 'scan-out',
         greatest(0, (40 + pidx * 7) - qty), NULL, 'SAMPLE', created, now());
    END;
  END LOOP;

  -- ------------------------------------------------------------- receipts
  FOR i IN 1..3 LOOP
    INSERT INTO "store"."receipts"
      (id, store_id, customer_id, amount, tender, against_bill_id, against_order_id,
       note, received_at, updated_at, deleted_at, synced_at)
    VALUES
      (gen_random_uuid(), s.id, cus[i], (ARRAY[500, 300, 450])[i],
       (ARRAY['cash','upi','cash'])[i], NULL, NULL, 'SAMPLE',
       now_ms - (i * 2) * 86400000, now_ms, NULL, now());
  END LOOP;

  -- ------------------------------------------------------------- purchases
  FOR i IN 1..3 LOOP
    DECLARE
      puid  uuid := gen_random_uuid();
      pidx  int := i * 3;              -- products 3,6,9
      qty   numeric := 20 + i * 5;
      cost  numeric := pcost[pidx];
      sub   numeric := qty * cost;
      gin   numeric := CASE WHEN s.gst THEN round(sub * pgst[pidx] / 100, 2) ELSE 0 END;
      tot   numeric := sub + gin;
      paidamt numeric := CASE WHEN i = 1 THEN tot ELSE CASE WHEN i = 2 THEN round(tot / 2) ELSE 0 END END;
      recd  bigint := now_ms - (i * 4) * 86400000;
    BEGIN
      INSERT INTO "store"."purchases"
        (id, store_id, invoice_no, supplier_id, supplier_name, invoice_date, lines,
         subtotal, gst_input, total, paid, note, received_at, created_at,
         updated_at, deleted_at, synced_at)
      VALUES
        (puid, s.id, 'INV-' || (70 + i)::text, sup[i], supname[i],
         to_char(to_timestamp(recd / 1000), 'YYYY-MM-DD'),
         jsonb_build_array(jsonb_build_object(
           'productId', p[pidx], 'name', pname[pidx], 'qty', qty, 'unit', punit[pidx],
           'costPrice', cost, 'gstRate', CASE WHEN s.gst THEN pgst[pidx] ELSE 0 END)),
         sub, gin, tot, paidamt, 'SAMPLE', recd, recd, now_ms, NULL, now());

      -- stock-in movement (ex-GST cost)
      INSERT INTO "store"."stock_movements"
        (id, store_id, product_id, user_id, supplier_id, delta, reason, qty_after,
         unit_cost, note, created_at, synced_at)
      VALUES
        (gen_random_uuid(), s.id, p[pidx], NULL, sup[i], qty, 'scan-in',
         (40 + pidx * 7) + qty, cost, 'SAMPLE', recd, now());

      -- mirror the paid part into supplier_payments
      IF paidamt > 0 THEN
        INSERT INTO "store"."supplier_payments"
          (id, store_id, supplier_id, amount, note, paid_at, updated_at, deleted_at, synced_at)
        VALUES (gen_random_uuid(), s.id, sup[i], paidamt, 'SAMPLE', recd, now_ms, NULL, now());
      END IF;
    END;
  END LOOP;

  -- ------------------------------------------------------------- expenses
  FOR i IN 1..5 LOOP
    INSERT INTO "store"."expenses"
      (id, store_id, category, amount, tender, payee, note, gst_input, spent_at,
       created_at, updated_at, deleted_at, synced_at)
    VALUES
      (gen_random_uuid(), s.id,
       (ARRAY['rent','electricity','salary','transport','refreshments'])[i],
       (ARRAY[12000, 2400, 8000, 650, 220])[i],
       (ARRAY['upi','cash','cash','cash','cash'])[i],
       (ARRAY['Landlord','TNEB','Staff','Auto','Tea shop'])[i],
       'SAMPLE', 0,
       now_ms - (i * 3) * 86400000, now_ms - (i * 3) * 86400000, now_ms, NULL, now());
  END LOOP;

  -- --------------------------------------------------------------- orders
  FOR i IN 1..2 LOOP
    DECLARE
      total numeric := (ARRAY[9000, 1800])[i];
      adv   numeric := (ARRAY[3000, 0])[i];
      oid   uuid := gen_random_uuid();
      ocre  bigint := now_ms - (i * 5) * 86400000;
    BEGIN
      INSERT INTO "store"."orders"
        (id, store_id, order_no, customer_id, customer_name, lines, total,
         advance_paid, status, due_date, note, bill_id, created_at, updated_at,
         deleted_at, synced_at)
      VALUES
        (oid, s.id, 'SD-O-' || lpad(i::text, 4, '0'), cus[i], cusname[i],
         jsonb_build_array(jsonb_build_object(
           'description', CASE WHEN s.gst THEN '500 wedding cards, gold foil' ELSE 'Bulk grocery order' END,
           'qty', CASE WHEN s.gst THEN 500 ELSE 1 END,
           'rate', CASE WHEN s.gst THEN 18 ELSE total END)),
         total, adv, (ARRAY['in_progress','booked'])[i],
         to_char(to_timestamp((now_ms + 5 * 86400000) / 1000), 'YYYY-MM-DD'),
         'SAMPLE', NULL, ocre, now_ms, NULL, now());

      -- advance receipt against the order
      IF adv > 0 THEN
        INSERT INTO "store"."receipts"
          (id, store_id, customer_id, amount, tender, against_bill_id,
           against_order_id, note, received_at, updated_at, deleted_at, synced_at)
        VALUES (gen_random_uuid(), s.id, cus[i], adv, 'cash', NULL, oid,
                'SAMPLE', ocre, now_ms, NULL, now());
      END IF;
    END;
  END LOOP;

END LOOP;
END $$;

-- quick check
SELECT st.name,
       (SELECT count(*) FROM "store"."products"  x WHERE x.store_id = st.id AND x.hsn  = 'SAMPLE') AS products,
       (SELECT count(*) FROM "store"."sales"     x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS sales,
       (SELECT count(*) FROM "store"."purchases" x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS purchases,
       (SELECT count(*) FROM "store"."expenses"  x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS expenses,
       (SELECT count(*) FROM "store"."customers" x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS customers,
       (SELECT count(*) FROM "store"."orders"    x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS orders
FROM "store"."stores" st
WHERE st.id IN ('50000000-0000-0000-0000-000000000001',
                '50000000-0000-0000-0000-000000000002');
