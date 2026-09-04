-- ===========================================================================
-- Sample data for EVERY store in store.stores, so every screen + report shows
-- realistic content on every test account. Re-runnable: it deletes prior rows
-- tagged note='SAMPLE' (products: hsn='SAMPLE') before re-inserting.
--
-- Each store's catalogue + tax behaviour is chosen from its own `gst_enabled`
-- flag: GST stores get the LB-cards catalogue with 5/12/18/28 slabs, non-GST
-- stores get the kirana catalogue at 0%. (The two original pilots ---
-- 50000000-…-0001 Kavin Store, 50000000-…-0002 Lenin Mobiles --- are just two
-- more rows now.)
--
-- Run AFTER round29..round34. Needs gen_random_uuid() (Neon has pgcrypto).
-- Clients pick this up on their next sync (server synced_at > client cursor).
--
-- Volume PER store: 16 products, 5 suppliers, 7 customers, ~47 sales
-- (multi-line, per-line + bill discounts, multi-rate GST) + 2 refunds,
-- ~20 UPI receipts, ~14 customer/order receipts, 8 purchases, 6 supplier
-- payments, 16 expenses, 6 orders (booked / in-progress / ready / delivered /
-- cancelled), plus write-off + stock-take movements. Scales linearly with the
-- store count --- fine for the test phase, revisit if stores.count gets large.
-- ===========================================================================

DELETE FROM "store"."sales"             WHERE note = 'SAMPLE';
DELETE FROM "store"."stock_movements"   WHERE note = 'SAMPLE';
DELETE FROM "store"."upi_receipts"      WHERE note = 'SAMPLE';
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
  s        RECORD;
  dayms    bigint := 86400000;                            -- ms/day (bigint!)
  now_ms   bigint := (extract(epoch FROM now()) * 1000)::bigint;
  d        int;
  i        int;
  n        int := 16;                                      -- products per store
  p        uuid[];
  pname    text[];  pmrp numeric[];  pprice numeric[];  pcost numeric[];
  pgst     numeric[];  punit text[];  stk numeric[];  pexp text[];
  sup      uuid[];  supname text[];
  cus      uuid[];  cusname text[];  cusopen numeric[];  cuscl numeric[];
  billids  uuid[] := ARRAY[]::uuid[];
  bill_seq int;
BEGIN
FOR s IN
  SELECT id, gst_enabled AS gst
  FROM "store"."stores"
LOOP
  -- Per-store bill ledger — reset so refunds below only ever point at a bill
  -- from THIS store (billids is declared once, outside this loop).
  billids := ARRAY[]::uuid[];

  ---------------------------------------------------------------- products
  IF s.gst THEN
    pname  := ARRAY['Wedding Card Premium','Wedding Card Standard','Visiting Card 1000',
                    'Flex Banner (sqft)','Photo Frame A4','Screen Guard','Phone Cover',
                    'Power Bank 10000mAh','Earphones Wired','USB-C Cable','Pen Drive 32GB',
                    'A4 Paper Ream','Lamination (sheet)','ID Card Print','Memory Card 64GB',
                    'Ink Cartridge'];
    pmrp   := ARRAY[45,25,600,18,180,120,199,1200,599,150,450,320,20,40,650,900];
    pprice := ARRAY[40,22,550,15,160,99,180,1050,499,130,420,300,15,30,560,820];
    pcost  := ARRAY[24,13,380,8,110,55,110,820,330,80,300,250,6,12,400,620];
    pgst   := ARRAY[12,12,18,18,12,18,18,28,28,18,18,12,18,18,28,18];
    punit  := ARRAY['piece','piece','box','piece','piece','piece','piece','piece',
                    'piece','piece','piece','box','piece','piece','piece','piece'];
    stk    := ARRAY[40,120,15,3,25,200,60,8,12,150,30,20,300,180,4,10];
    pexp   := ARRAY[NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
                    NULL,NULL,NULL,NULL,NULL,NULL]::text[];
  ELSE
    pname  := ARRAY['Aashirvaad Atta 5kg','Sugar (loose kg)','Toor Dal (kg)','Sunflower Oil 1L',
                    'Amul Butter 500g','Colgate 150g','Surf Excel 1kg','Maggi 12-pack',
                    'Tea Powder 250g','Marie Biscuit','Boost 500g','Rice 25kg bag',
                    'Coconut Oil 500ml','Salt 1kg','Milk 500ml','Eggs (tray 30)'];
    pmrp   := ARRAY[285,0,0,145,275,99,140,168,150,30,255,1450,190,28,30,210];
    pprice := ARRAY[280,45,130,140,270,95,135,160,145,28,245,1400,185,26,28,200];
    pcost  := ARRAY[255,40,118,128,255,80,120,150,130,22,220,1320,165,22,25,180];
    pgst   := ARRAY[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    punit  := ARRAY['packet','kg','kg','piece','piece','piece','packet','box',
                    'packet','packet','piece','packet','piece','packet','packet','box'];
    stk    := ARRAY[3,60,45,8,2,90,30,12,25,120,15,4,50,80,6,18];
    pexp   := ARRAY[NULL,NULL,NULL,NULL,
                    to_char(to_timestamp((now_ms - 1*dayms)/1000),'YYYY-MM-DD'),  -- butter: expired
                    NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
                    to_char(to_timestamp((now_ms + 2*dayms)/1000),'YYYY-MM-DD'),  -- milk: expiring soon
                    to_char(to_timestamp((now_ms + 9*dayms)/1000),'YYYY-MM-DD')]::text[]; -- eggs: ok
  END IF;

  p := ARRAY[]::uuid[];
  FOR i IN 1..n LOOP
    p := p || gen_random_uuid();
    INSERT INTO "store"."products"
      (id, store_id, barcode, name, mrp, price, cost_price, stock_qty, unit,
       low_stock_threshold, expiry_date, gst_rate, hsn, updated_at, deleted_at, synced_at)
    VALUES
      (p[i], s.id,
       CASE WHEN i % 3 = 0 THEN '890' || lpad((100000 + i * 37)::text, 9, '0') ELSE NULL END,
       pname[i], pmrp[i], pprice[i], pcost[i], stk[i], punit[i],
       5, pexp[i], pgst[i], 'SAMPLE', now_ms, NULL, now());
    INSERT INTO "store"."stock_movements"
      (id, store_id, product_id, user_id, supplier_id, delta, reason, qty_after,
       unit_cost, note, created_at, synced_at)
    VALUES
      (gen_random_uuid(), s.id, p[i], NULL, NULL, stk[i] + 20, 'opening',
       stk[i] + 20, pcost[i], 'SAMPLE', now_ms - 55 * dayms, now());
  END LOOP;

  -- a couple of write-offs + a stock-take, for the adjustments / audit views
  INSERT INTO "store"."stock_movements"
    (id, store_id, product_id, user_id, supplier_id, delta, reason, qty_after,
     unit_cost, note, created_at, synced_at)
  VALUES
    (gen_random_uuid(), s.id, p[5], NULL, NULL, -2, 'damage',  greatest(0, stk[5] - 2),
     pcost[5], 'SAMPLE', now_ms - 6 * dayms, now()),
    (gen_random_uuid(), s.id, p[1], NULL, NULL, -1, 'expiry',  greatest(0, stk[1] - 1),
     pcost[1], 'SAMPLE', now_ms - 4 * dayms, now()),
    (gen_random_uuid(), s.id, p[6], NULL, NULL,  3, 'correction', stk[6] + 3,
     pcost[6], 'SAMPLE', now_ms - 3 * dayms, now()),
    (gen_random_uuid(), s.id, p[2], NULL, NULL,  0, 'count', stk[2],
     pcost[2], 'SAMPLE', now_ms - 2 * dayms, now());

  --------------------------------------------------------------- suppliers
  IF s.gst THEN
    supname := ARRAY['Sri Paper Mart','Mobile World Distributors','LB Print Supplies',
                     'Chennai Accessories Co','Foto Frame House'];
  ELSE
    supname := ARRAY['Metro Wholesale','Krishna Traders','Balaji Distributors',
                     'Anand Dairy Supply','Sun Rice Mills'];
  END IF;
  sup := ARRAY[]::uuid[];
  FOR i IN 1..5 LOOP
    sup := sup || gen_random_uuid();
    INSERT INTO "store"."suppliers"
      (id, store_id, name, phone, note, updated_at, deleted_at, synced_at)
    VALUES (sup[i], s.id, supname[i], '90000' || (10000 + i)::text, 'SAMPLE',
            now_ms, NULL, now());
  END LOOP;

  --------------------------------------------------------------- customers
  IF s.gst THEN
    cusname := ARRAY['Ravi Traders','Selvi Wedding Hall','Kumar Photo Studio',
                     'St Xavier School Office','Green Leaf Caterers','Anitha Boutique',
                     'Walk-in Regular'];
  ELSE
    cusname := ARRAY['Lakshmi (flat 3B)','Murugan Anna','Fathima Store',
                     'Ward member office','Suresh (auto stand)','Mary Teacher',
                     'Hostel Mess Contractor'];
  END IF;
  cusopen := ARRAY[1200, 0, 450, 0, 2600, -500, 0];   -- negative = advance with us
  cuscl   := ARRAY[10000, 10000, 5000, 15000, 8000, 3000, 20000];
  cus := ARRAY[]::uuid[];
  FOR i IN 1..7 LOOP
    cus := cus || gen_random_uuid();
    INSERT INTO "store"."customers"
      (id, store_id, name, phone, place, gstin, credit_limit, opening_balance,
       note, updated_at, deleted_at, synced_at)
    VALUES (cus[i], s.id, cusname[i], '98765' || (43000 + i)::text,
            CASE WHEN s.gst THEN 'Marthandam' ELSE 'Nagercoil' END,
            CASE WHEN s.gst AND i IN (1, 4) THEN '33ABCDE' || (1234 + i)::text || 'F1Z5' ELSE NULL END,
            cuscl[i], cusopen[i], 'SAMPLE', now_ms, NULL, now());
  END LOOP;

  ------------------------------------------------------------------- sales
  bill_seq := 0;
  FOR d IN 0..40 LOOP
    -- 1 bill every day, a 2nd smaller bill on ~1 day in 7
    FOR i IN 0..(CASE WHEN d % 7 = 0 THEN 1 ELSE 0 END) LOOP
      bill_seq := bill_seq + 1;
      DECLARE
        bid      uuid := gen_random_uuid();
        created  bigint := now_ms - d * dayms - (3600000 * (1 + (bill_seq % 6)));
        nlines   int := CASE WHEN i = 1 THEN 1 ELSE 1 + ((d + bill_seq) % 3) END;
        k        int;
        pidx     int;
        q        numeric;
        up       numeric;
        lpct     numeric;
        ldisc    numeric;
        lgross   numeric;
        lnet     numeric;
        ltxbl    numeric;
        ltx      numeric;
        slot     int;
        r_i      int;
        lines    jsonb := '[]'::jsonb;
        subtotal numeric := 0;
        txbl     numeric[] := ARRAY[0,0,0,0];
        txam     numeric[] := ARRAY[0,0,0,0];
        tbreak   jsonb := '[]'::jsonb;
        taxtot   numeric := 0;
        billdisc numeric := CASE WHEN d % 9 = 0 AND i = 0 THEN 20 ELSE 0 END;
        preround numeric;
        total    numeric;
        roundoff numeric;
        tender   text := (ARRAY['cash','upi','cash','card','credit','cash','upi',
                                'split','cash','credit','upi','cash'])[1 + (d % 12)];
        cust     uuid;
        cashamt  numeric := 0;  upiamt numeric := 0;  cardamt numeric := 0;
        sman     text := CASE WHEN s.gst
                              THEN (ARRAY['Lenin','Arun','Lenin','COUNTER'])[1 + (d % 4)]
                              ELSE (ARRAY['COUNTER','Ramesh','COUNTER','Priya'])[1 + (d % 4)]
                         END;
      BEGIN
        FOR k IN 0..(nlines - 1) LOOP
          pidx   := 1 + ((d * 2 + k * 5 + bill_seq) % n);
          q      := 1 + ((d + k) % 4);
          up     := pprice[pidx];
          lpct   := CASE WHEN (d + k) % 5 = 0 THEN 5 ELSE 0 END;
          lgross := q * up;
          ldisc  := round(lgross * lpct / 100, 2);
          lnet   := lgross - ldisc;
          subtotal := subtotal + lnet;

          IF s.gst AND pgst[pidx] > 0 THEN
            slot := CASE pgst[pidx] WHEN 5 THEN 1 WHEN 12 THEN 2
                                    WHEN 18 THEN 3 WHEN 28 THEN 4 END;
            ltxbl := round(lnet / (1 + pgst[pidx] / 100), 2);
            ltx   := round(lnet - ltxbl, 2);
            txbl[slot] := txbl[slot] + ltxbl;
            txam[slot] := txam[slot] + ltx;
          END IF;

          lines := lines || jsonb_build_object(
            'productId', p[pidx], 'name', pname[pidx], 'qty', q, 'unit', punit[pidx],
            'unitPrice', up, 'discount', ldisc, 'discountPct', lpct,
            'gstRate', CASE WHEN s.gst THEN pgst[pidx] ELSE 0 END);

          INSERT INTO "store"."stock_movements"
            (id, store_id, product_id, user_id, supplier_id, delta, reason, qty_after,
             unit_cost, note, created_at, synced_at)
          VALUES
            (gen_random_uuid(), s.id, p[pidx], NULL, NULL, -q, 'scan-out',
             greatest(0, stk[pidx] - q), NULL, 'SAMPLE', created, now());
        END LOOP;

        IF s.gst THEN
          FOR r_i IN 1..4 LOOP
            IF txbl[r_i] > 0 THEN
              taxtot := taxtot + txam[r_i];
              tbreak := tbreak || jsonb_build_object(
                'rate',    (ARRAY[5,12,18,28])[r_i],
                'taxable', txbl[r_i],
                'cgst',    round(txam[r_i] / 2, 2),
                'sgst',    round(txam[r_i] / 2, 2));
            END IF;
          END LOOP;
        END IF;

        preround := subtotal - billdisc;
        total    := round(preround);
        roundoff := round((total - preround)::numeric, 2);

        cust := CASE
                  WHEN tender = 'credit' THEN cus[1 + (d % 3)]
                  WHEN d % 6 = 0         THEN cus[1 + (d % 5)]
                  ELSE NULL
                END;

        IF    tender = 'cash'  THEN cashamt := total;
        ELSIF tender = 'upi'   THEN upiamt  := total;
        ELSIF tender = 'card'  THEN cardamt := total;
        ELSIF tender = 'split' THEN
          upiamt  := round(total * 0.6);
          cardamt := CASE WHEN d % 2 = 0 THEN total - round(total * 0.6) ELSE 0 END;
          cashamt := CASE WHEN d % 2 = 0 THEN 0 ELSE total - round(total * 0.6) END;
        END IF;

        INSERT INTO "store"."sales"
          (id, store_id, user_id, bill_no, items, discount, tax_total, tax_breakup,
           roundoff, total, tender_type, customer_id, cash_amount, upi_amount,
           card_amount, salesman, refund_of, note, created_at, updated_at,
           deleted_at, synced_at)
        VALUES
          (bid, s.id, NULL, 'SD-' || lpad(bill_seq::text, 4, '0'),
           lines, billdisc, taxtot, tbreak, roundoff, total, tender, cust,
           cashamt, upiamt, cardamt, sman, NULL, 'SAMPLE',
           created, created, NULL, now());

        billids := billids || bid;

        -- UPI money actually received (leave ~1 in 5 unmatched for reconcile)
        IF tender IN ('upi', 'split') AND d % 5 <> 0 THEN
          INSERT INTO "store"."upi_receipts"
            (id, store_id, user_id, amount, received_at, ref, payer_name, source,
             matched_sale_id, note, updated_at, deleted_at, synced_at)
          VALUES
            (gen_random_uuid(), s.id, NULL, upiamt, created + 120000,
             'UPI' || lpad(bill_seq::text, 6, '0'),
             CASE WHEN cust IS NOT NULL THEN cusname[1 + (d % 5)] ELSE 'Customer' END,
             'manual', bid, 'SAMPLE', now_ms, NULL, now());
        END IF;
      END;
    END LOOP;
  END LOOP;

  -- two unmatched UPI credits (money in the bank, no bill yet)
  INSERT INTO "store"."upi_receipts"
    (id, store_id, user_id, amount, received_at, ref, payer_name, source,
     matched_sale_id, note, updated_at, deleted_at, synced_at)
  VALUES
    (gen_random_uuid(), s.id, NULL, 250, now_ms - 1 * dayms, 'UPI900001',
     'Unknown', 'manual', NULL, 'SAMPLE', now_ms, NULL, now()),
    (gen_random_uuid(), s.id, NULL, 480, now_ms - 3 * dayms, 'UPI900002',
     'Unknown', 'manual', NULL, 'SAMPLE', now_ms, NULL, now());

  ------------------------------------------------------------------ refunds
  FOR i IN 1..2 LOOP
    DECLARE
      orig  uuid := billids[array_length(billids, 1) - (i * 6)];
      rbid  uuid := gen_random_uuid();
      rpidx int  := 1 + (i * 3);
      rup   numeric := pprice[1 + (i * 3)];
      rcre  bigint := now_ms - (i * 5) * dayms - 7200000;
    BEGIN
      INSERT INTO "store"."sales"
        (id, store_id, user_id, bill_no, items, discount, tax_total, tax_breakup,
         roundoff, total, tender_type, customer_id, cash_amount, upi_amount,
         card_amount, salesman, refund_of, note, created_at, updated_at,
         deleted_at, synced_at)
      VALUES
        (rbid, s.id, NULL, 'SD-R-' || lpad(i::text, 4, '0'),
         jsonb_build_array(jsonb_build_object(
           'productId', p[rpidx], 'name', pname[rpidx], 'qty', -1, 'unit', punit[rpidx],
           'unitPrice', rup, 'discount', 0, 'discountPct', 0,
           'gstRate', CASE WHEN s.gst THEN pgst[rpidx] ELSE 0 END)),
         0, 0, '[]'::jsonb, 0, -rup, 'cash', NULL,
         -rup, 0, 0, 'COUNTER', orig, 'SAMPLE', rcre, rcre, NULL, now());

      INSERT INTO "store"."stock_movements"
        (id, store_id, product_id, user_id, supplier_id, delta, reason, qty_after,
         unit_cost, note, created_at, synced_at)
      VALUES
        (gen_random_uuid(), s.id, p[rpidx], NULL, NULL, 1, 'sale-return',
         stk[rpidx] + 1, NULL, 'SAMPLE', rcre, now());
    END;
  END LOOP;

  ---------------------------------------------------- customer receipts (khata)
  FOR i IN 1..3 LOOP
    INSERT INTO "store"."receipts"
      (id, store_id, customer_id, amount, tender, against_bill_id, against_order_id,
       note, received_at, updated_at, deleted_at, synced_at)
    VALUES
      (gen_random_uuid(), s.id, cus[i], (ARRAY[500, 300, 450])[i],
       (ARRAY['cash','upi','cash'])[i], NULL, NULL, 'SAMPLE',
       now_ms - (i * 2) * dayms, now_ms, NULL, now()),
      (gen_random_uuid(), s.id, cus[i], (ARRAY[1000, 250, 200])[i],
       (ARRAY['upi','cash','upi'])[i], NULL, NULL, 'SAMPLE',
       now_ms - (i * 9) * dayms, now_ms, NULL, now());
  END LOOP;

  ------------------------------------------------------------------ purchases
  FOR i IN 1..8 LOOP
    DECLARE
      puid    uuid := gen_random_uuid();
      j       int;
      nl      int := 1 + (i % 3);
      plines  jsonb := '[]'::jsonb;
      sub     numeric := 0;
      gin     numeric := 0;
      tot     numeric;
      paidamt numeric;
      recd    bigint := now_ms - (i * 6) * dayms;
      pidx    int;
      qy      numeric;
      cst     numeric;
      supi    int := 1 + (i % 5);
    BEGIN
      FOR j IN 0..(nl - 1) LOOP
        pidx := 1 + ((i * 4 + j * 3) % n);
        qy   := 15 + (i + j) * 5;
        cst  := pcost[pidx];
        sub  := sub + qy * cst;
        gin  := gin + CASE WHEN s.gst THEN round(qy * cst * pgst[pidx] / 100, 2) ELSE 0 END;
        plines := plines || jsonb_build_object(
          'productId', p[pidx], 'name', pname[pidx], 'qty', qy, 'unit', punit[pidx],
          'costPrice', cst, 'gstRate', CASE WHEN s.gst THEN pgst[pidx] ELSE 0 END);
        INSERT INTO "store"."stock_movements"
          (id, store_id, product_id, user_id, supplier_id, delta, reason, qty_after,
           unit_cost, note, created_at, synced_at)
        VALUES
          (gen_random_uuid(), s.id, p[pidx], NULL, sup[supi], qy, 'scan-in',
           stk[pidx] + qy, cst, 'SAMPLE', recd, now());
      END LOOP;

      tot := sub + gin;
      paidamt := CASE WHEN i % 3 = 1 THEN tot
                      WHEN i % 3 = 2 THEN round(tot / 2)
                      ELSE 0 END;

      INSERT INTO "store"."purchases"
        (id, store_id, invoice_no, supplier_id, supplier_name, invoice_date, lines,
         subtotal, gst_input, total, paid, note, received_at, created_at,
         updated_at, deleted_at, synced_at)
      VALUES
        (puid, s.id, 'INV-' || (700 + i)::text, sup[supi], supname[supi],
         to_char(to_timestamp(recd / 1000), 'YYYY-MM-DD'),
         plines, sub, gin, tot, paidamt, 'SAMPLE', recd, recd, now_ms, NULL, now());

      IF paidamt > 0 THEN
        INSERT INTO "store"."supplier_payments"
          (id, store_id, supplier_id, amount, note, paid_at, updated_at, deleted_at, synced_at)
        VALUES (gen_random_uuid(), s.id, sup[supi], paidamt, 'SAMPLE', recd + 3600000,
                now_ms, NULL, now());
      END IF;
    END;
  END LOOP;

  -- two standalone supplier payments (part-settling old balances)
  INSERT INTO "store"."supplier_payments"
    (id, store_id, supplier_id, amount, note, paid_at, updated_at, deleted_at, synced_at)
  VALUES
    (gen_random_uuid(), s.id, sup[1], 2000, 'SAMPLE', now_ms - 10 * dayms, now_ms, NULL, now()),
    (gen_random_uuid(), s.id, sup[3], 1500, 'SAMPLE', now_ms - 20 * dayms, now_ms, NULL, now());

  ------------------------------------------------------------------ expenses
  FOR i IN 1..16 LOOP
    DECLARE
      cat  text := (ARRAY['rent','electricity','salary','transport','supplies',
                          'refreshments','repairs','communication','bank','tax',
                          'rent_equipment','other','electricity','transport',
                          'refreshments','supplies'])[i];
      amt  numeric := (ARRAY[12000,2400,8000,650,1350,220,900,499,150,3000,
                             1800,300,2600,480,180,760])[i];
      tnd  text := (ARRAY['upi','cash','cash','cash','upi','cash','cash','upi',
                          'cash','upi','upi','cash','cash','cash','cash','upi'])[i];
      pye  text := (ARRAY['Landlord','TNEB','Staff wages','Auto freight','Packing material',
                          'Tea shop','AC repair','Jio recharge','Bank charges','GST challan',
                          'Xerox machine rent','Sundry','TNEB','Tempo hire','Snacks',
                          'Carry bags'])[i];
      gi   numeric := CASE WHEN s.gst AND i IN (5, 7, 8, 16)
                           THEN round((ARRAY[12000,2400,8000,650,1350,220,900,499,150,3000,
                                             1800,300,2600,480,180,760])[i] * 0.09, 2)
                           ELSE 0 END;
      sp   bigint := now_ms - (i * 3 + (i % 4)) * dayms;
    BEGIN
      INSERT INTO "store"."expenses"
        (id, store_id, category, amount, tender, payee, note, gst_input, spent_at,
         created_at, updated_at, deleted_at, synced_at)
      VALUES
        (gen_random_uuid(), s.id, cat, amt, tnd, pye, 'SAMPLE', gi, sp,
         sp, now_ms, NULL, now());
    END;
  END LOOP;

  -------------------------------------------------------------------- orders
  FOR i IN 1..6 LOOP
    DECLARE
      otot  numeric := (ARRAY[9000, 1800, 4500, 2600, 12000, 3000])[i];
      oadv  numeric := (ARRAY[3000, 0, 1500, 2600, 4000, 500])[i];
      ostat text    := (ARRAY['booked','in_progress','in_progress','ready',
                              'delivered','cancelled'])[i];
      oid   uuid := gen_random_uuid();
      ocre  bigint := now_ms - (i * 5 + 4) * dayms;
      obill uuid := NULL;
      odesc text := CASE WHEN s.gst
                         THEN (ARRAY['500 wedding cards, gold foil','100 visiting cards',
                                     '6x4 ft flex + stand','20 laminated ID cards',
                                     '1000 wedding cards + envelopes','Photo frame set (12)'])[i]
                         ELSE (ARRAY['Monthly grocery hamper','Small provisions pack',
                                     'Festival gift box x10','Rice + oil bulk',
                                     'Hostel mess supply (week)','Sweets order'])[i]
                    END;
    BEGIN
      IF ostat = 'delivered' THEN
        obill := gen_random_uuid();
        INSERT INTO "store"."sales"
          (id, store_id, user_id, bill_no, items, discount, tax_total, tax_breakup,
           roundoff, total, tender_type, customer_id, cash_amount, upi_amount,
           card_amount, salesman, refund_of, note, created_at, updated_at,
           deleted_at, synced_at)
        VALUES
          (obill, s.id, NULL, 'SD-OD-' || lpad(i::text, 4, '0'),
           '[]'::jsonb, 0, 0, '[]'::jsonb, 0, (otot - oadv), 'upi',
           cus[1 + (i % 6)], 0, (otot - oadv), 0,
           CASE WHEN s.gst THEN 'Lenin' ELSE 'COUNTER' END,
           NULL, 'SAMPLE', ocre + 3 * dayms, ocre + 3 * dayms, NULL, now());
      END IF;

      INSERT INTO "store"."orders"
        (id, store_id, order_no, customer_id, customer_name, lines, total,
         advance_paid, status, due_date, note, bill_id, created_at, updated_at,
         deleted_at, synced_at)
      VALUES
        (oid, s.id, 'SD-O-' || lpad(i::text, 4, '0'), cus[1 + (i % 6)], cusname[1 + (i % 6)],
         jsonb_build_array(jsonb_build_object(
           'description', odesc,
           'qty', (ARRAY[500, 100, 1, 20, 1000, 12])[i],
           'rate', round(otot / (ARRAY[500, 100, 1, 20, 1000, 12])[i], 2))),
         otot,
         CASE WHEN ostat = 'delivered' THEN otot ELSE oadv END,
         ostat,
         to_char(to_timestamp((now_ms + (i - 3) * dayms) / 1000), 'YYYY-MM-DD'),
         'SAMPLE', obill, ocre, now_ms, NULL, now());

      IF oadv > 0 THEN
        INSERT INTO "store"."receipts"
          (id, store_id, customer_id, amount, tender, against_bill_id,
           against_order_id, note, received_at, updated_at, deleted_at, synced_at)
        VALUES (gen_random_uuid(), s.id, cus[1 + (i % 6)], oadv, 'cash', NULL, oid,
                'SAMPLE', ocre, now_ms, NULL, now());
      END IF;
    END;
  END LOOP;

END LOOP;
END $$;

SELECT st.name,
       (SELECT count(*) FROM "store"."products"          x WHERE x.store_id = st.id AND x.hsn  = 'SAMPLE') AS products,
       (SELECT count(*) FROM "store"."stock_movements"   x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS movements,
       (SELECT count(*) FROM "store"."sales"             x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS sales,
       (SELECT count(*) FROM "store"."upi_receipts"      x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS upi_receipts,
       (SELECT count(*) FROM "store"."purchases"         x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS purchases,
       (SELECT count(*) FROM "store"."supplier_payments" x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS supplier_payments,
       (SELECT count(*) FROM "store"."receipts"          x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS receipts,
       (SELECT count(*) FROM "store"."expenses"          x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS expenses,
       (SELECT count(*) FROM "store"."customers"         x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS customers,
       (SELECT count(*) FROM "store"."suppliers"         x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS suppliers,
       (SELECT count(*) FROM "store"."orders"            x WHERE x.store_id = st.id AND x.note = 'SAMPLE') AS orders
FROM "store"."stores" st
ORDER BY st.name;
