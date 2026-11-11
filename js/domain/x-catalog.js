/* Orbis v2 — tenant back-office extension: catalog (RD-12). Categories, variant archive, modifier groups, per-outlet price.
   Pure (no DOM). Extends Orbis.domain.catalog (finance.js) and implements Orbis.hooks.skuPrice / resolveModifiers.
   Data: categories {id,tenant,name,sort,archived} · modifierGroups {id,tenant,name,required,min,max,options[{id,name,price}],archived}
         skuOutlets {tenant,skuId,outlet,price|null,available} · products.modifierGroupIds[] · products.archived · skus.archived */
(function (g) {
  'use strict';
  var Orbis = g.Orbis;
  var C = Orbis.domain.catalog = Orbis.domain.catalog || {};   // finance.js loads earlier in browser and harness (alphabetical)

  function str(v) { return String(v == null ? '' : v).trim(); }
  function find(d, coll, id, label) {
    var r = Orbis.mine(d, coll).filter(function (x) { return x.id === id; })[0];
    if (!r) throw Orbis.Err('NOT_FOUND', (label || 'Data') + ' tidak ditemukan');
    return r;
  }
  function coll(d, name) { d[name] = d[name] || []; return d[name]; }
  function write(action, entity, fn) {
    Orbis.require('catalog.write');
    return Orbis.tx(fn, { audit: function (r) { return { action: action, entity: entity, entityId: r && r.id }; } });
  }
  function toInt(v, label) { if (typeof v === 'string' && /^\d+$/.test(v.trim())) v = Number(v); return Orbis.int(v, label); }

  /* ---------- categories ---------- */
  C.categories = function (d, all) {
    return Orbis.mine(d, 'categories').filter(function (c) { return all || !c.archived; }).sort(function (a, b) { return a.sort - b.sort; });
  };
  function uniqueName(d, name, ignoreId) {
    Orbis.need(name, 'VALIDATION', 'Nama kategori wajib diisi');
    Orbis.need(name.length <= 40, 'VALIDATION', 'Nama kategori maksimal 40 karakter');
    Orbis.need(!Orbis.mine(d, 'categories').some(function (c) { return c.id !== ignoreId && c.name.toLowerCase() === name.toLowerCase(); }), 'DUPLICATE', 'Kategori "' + name + '" sudah ada');
  }
  C.createCategory = function (name) {
    return write('catalog.category.create', 'category', function (d) {
      name = str(name); uniqueName(d, name);
      var c = { id: Orbis.nextId(d, 'CAT', 3), tenant: d.session.tenant, name: name, sort: Orbis.mine(d, 'categories').length, archived: false };
      coll(d, 'categories').push(c); return c;
    });
  };
  /** Rename also rewrites product.category (products store the name, used by POS/storefront/reports). */
  C.renameCategory = function (id, name) {
    return write('catalog.category.rename', 'category', function (d) {
      var c = find(d, 'categories', id, 'Kategori'); name = str(name); uniqueName(d, name, id);
      Orbis.mine(d, 'products').forEach(function (p) { if (p.category === c.name) p.category = name; });
      c.name = name; return c;
    });
  };
  C.moveCategory = function (id, dir) {
    return write('catalog.category.reorder', 'category', function (d) {
      var list = C.categories(d, true), i = list.map(function (c) { return c.id; }).indexOf(id), j = i + (dir < 0 ? -1 : 1);
      Orbis.need(i >= 0, 'NOT_FOUND', 'Kategori tidak ditemukan');
      Orbis.need(j >= 0 && j < list.length, 'NO_CHANGE', 'Kategori sudah di ujung daftar');
      var t = list[i]; list[i] = list[j]; list[j] = t;
      list.forEach(function (c, k) { c.sort = k; });
      return list[j];
    });
  };
  C.archiveCategory = function (id, archived) {
    return write(archived ? 'catalog.category.archive' : 'catalog.category.unarchive', 'category', function (d) {
      var c = find(d, 'categories', id, 'Kategori'); c.archived = !!archived; return c;
    });
  };

  /* ---------- products / variants ---------- */
  C.archiveProduct = function (productId, archived) {
    return write(archived ? 'catalog.archive' : 'catalog.unarchive', 'product', function (d) {
      var p = find(d, 'products', productId, 'Produk');
      p.archived = !!archived;
      if (archived) p.published = false;   // archived products leave the storefront; unarchive stays draft
      return p;
    });
  };
  /** Archive/unarchive one variant. A product keeps at least one active variant. */
  C.archiveSku = function (skuId, archived) {
    return write(archived ? 'catalog.sku.archive' : 'catalog.sku.unarchive', 'sku', function (d) {
      var s = find(d, 'skus', skuId, 'Varian');
      if (archived) Orbis.need(Orbis.mine(d, 'skus').some(function (x) { return x.productId === s.productId && x.id !== s.id && !x.archived; }), 'LAST_VARIANT', 'Produk minimal punya satu varian aktif; arsipkan produknya saja');
      s.archived = !!archived; return s;
    });
  };

  /* ---------- modifier groups ---------- */
  C.modifierGroups = function (d, all) { return Orbis.mine(d, 'modifierGroups').filter(function (m) { return all || !m.archived; }); };
  /** spec {id?, name, required, min, max, options:[{name, price}]}. Options keep their id when the name is unchanged. */
  C.saveModifierGroup = function (spec) {
    spec = spec || {};
    return write(spec.id ? 'catalog.modifier.update' : 'catalog.modifier.create', 'modifierGroup', function (d) {
      var cur = spec.id ? find(d, 'modifierGroups', spec.id, 'Grup modifier') : null;
      var name = str(spec.name); Orbis.need(name, 'VALIDATION', 'Nama grup modifier wajib diisi');
      var opts = (spec.options || []).map(function (o) { return { name: str(o.name), price: o.price }; }).filter(function (o) { return o.name; });
      Orbis.need(opts.length >= 1, 'VALIDATION', 'Grup modifier minimal punya satu pilihan');
      var seen = {};
      opts.forEach(function (o) {
        toInt(o.price, 'Harga ' + o.name); o.price = toInt(o.price);
        Orbis.need(o.price >= 0, 'VALIDATION', 'Harga pilihan tidak boleh negatif');
        Orbis.need(!seen[o.name.toLowerCase()], 'VALIDATION', 'Pilihan "' + o.name + '" dobel'); seen[o.name.toLowerCase()] = 1;
        var old = cur && cur.options.filter(function (x) { return x.name.toLowerCase() === o.name.toLowerCase(); })[0];
        o.id = old ? old.id : Orbis.nextId(d, 'MDO', 4);
      });
      var required = !!spec.required, min = toInt(spec.min == null || spec.min === '' ? (required ? 1 : 0) : spec.min, 'Minimal pilih'), max = toInt(spec.max == null || spec.max === '' ? opts.length : spec.max, 'Maksimal pilih');
      if (required && min < 1) min = 1;
      Orbis.need(min >= 0 && max >= 1 && min <= max && max <= opts.length, 'VALIDATION', 'Aturan pilih tidak valid: 0 <= minimal <= maksimal <= jumlah pilihan');
      var gr = cur || { id: Orbis.nextId(d, 'MDG', 3), tenant: d.session.tenant, archived: false };
      gr.name = name; gr.required = required; gr.min = min; gr.max = max; gr.options = opts;
      if (!cur) coll(d, 'modifierGroups').push(gr);
      return gr;
    });
  };
  C.archiveModifierGroup = function (id, archived) {
    return write(archived ? 'catalog.modifier.archive' : 'catalog.modifier.unarchive', 'modifierGroup', function (d) {
      var gr = find(d, 'modifierGroups', id, 'Grup modifier'); gr.archived = !!archived; return gr;
    });
  };
  C.setProductModifiers = function (productId, groupIds) {
    return write('catalog.modifier.attach', 'product', function (d) {
      var p = find(d, 'products', productId, 'Produk');
      p.modifierGroupIds = (groupIds || []).filter(function (id, i, a) { return a.indexOf(id) === i; }).map(function (id) { return find(d, 'modifierGroups', id, 'Grup modifier').id; });
      return p;
    });
  };
  /** Active groups attached to the product of this sku (read). */
  C.groupsFor = function (d, productId) {
    var p = d.products.filter(function (x) { return x.id === productId && x.tenant === d.session.tenant; })[0];
    var ids = (p && p.modifierGroupIds) || [];
    return ids.map(function (id) { return C.modifierGroups(d).filter(function (m) { return m.id === id; })[0]; }).filter(Boolean);
  };

  /** Hook: validate picks against groups attached to the sku's product. Empty ids still enforce required groups. */
  C.resolveModifiers = function (d, sku, ids) {
    ids = ids || [];
    var groups = C.groupsFor(d, sku.productId), count = {}, out = [];
    ids.forEach(function (id, i) {
      Orbis.need(ids.indexOf(id) === i, 'MODIFIER_INVALID', 'Pilihan modifier dobel');
      var hit = null;
      groups.forEach(function (gr) { gr.options.forEach(function (o) { if (o.id === id) hit = { g: gr, o: o }; }); });
      Orbis.need(hit, 'MODIFIER_INVALID', 'Pilihan modifier tidak berlaku untuk produk ini');
      count[hit.g.id] = (count[hit.g.id] || 0) + 1;
      out.push({ id: hit.o.id, name: hit.o.name, price: hit.o.price });
    });
    groups.forEach(function (gr) {
      var n = count[gr.id] || 0;
      if (gr.required) Orbis.need(n >= Math.max(1, gr.min), 'MODIFIER_INVALID', 'Pilih ' + gr.name + ' (wajib, minimal ' + Math.max(1, gr.min) + ')');
      else if (n) Orbis.need(n >= gr.min, 'MODIFIER_INVALID', gr.name + ': pilih minimal ' + gr.min);
      Orbis.need(n <= gr.max, 'MODIFIER_INVALID', gr.name + ': maksimal ' + gr.max + ' pilihan');
    });
    return out;
  };

  /* ---------- per-outlet price & availability ---------- */
  C.outletRow = function (d, skuId, outlet) {
    return Orbis.mine(d, 'skuOutlets').filter(function (r) { return r.skuId === skuId && r.outlet === outlet; })[0] || null;
  };
  /** spec {price: int|null (null = harga dasar), available: bool}. Default row (no override, available) is removed. */
  C.setOutletPrice = function (skuId, outlet, spec) {
    spec = spec || {};
    return write('catalog.outlet.price', 'sku', function (d) {
      var s = find(d, 'skus', skuId, 'Varian');
      Orbis.need(d.outlets.some(function (o) { return o.id === outlet && o.tenant === d.session.tenant; }), 'NOT_FOUND', 'Outlet tidak ditemukan');
      var price = spec.price == null || spec.price === '' ? null : toInt(spec.price, 'Harga outlet');
      Orbis.need(price == null || price >= 0, 'VALIDATION', 'Harga outlet tidak boleh negatif');
      var available = spec.available !== false;
      var rows = coll(d, 'skuOutlets'), row = C.outletRow(d, skuId, outlet);
      if (price == null && available) { d.skuOutlets = rows.filter(function (r) { return r !== row; }); return { id: s.id }; }
      if (!row) { row = { tenant: d.session.tenant, skuId: s.id, outlet: outlet }; rows.push(row); }
      row.price = price; row.available = available;
      return { id: s.id };
    });
  };
  /** Hook: override price for this outlet, or throw when the sku is not sold there. */
  C.skuPrice = function (d, sku, outlet) {
    var r = C.outletRow(d, sku.id, outlet);
    if (!r) return undefined;
    Orbis.need(r.available !== false, 'NOT_AVAILABLE', 'Produk ' + sku.sku + ' tidak dijual di outlet ini');
    return r.price == null ? undefined : r.price;
  };
  C.availableAt = function (d, sku, outlet) { var r = C.outletRow(d, sku.id, outlet); return !r || r.available !== false; };

  Orbis.hooks.skuPrice = C.skuPrice;
  Orbis.hooks.resolveModifiers = C.resolveModifiers;

  /* ---------- seed: categories for every tenant, F&B modifiers + one outlet price for t1 ---------- */
  Orbis.seedHooks = Orbis.seedHooks || [];
  Orbis.seedHooks.push(function (db) {
    db.categories = []; db.modifierGroups = []; db.skuOutlets = [];
    db.products.forEach(function (p) {
      if (!db.categories.some(function (c) { return c.tenant === p.tenant && c.name === p.category; })) {
        db.categories.push({ id: Orbis.nextId(db, 'CAT', 3), tenant: p.tenant, name: p.category, sort: db.categories.filter(function (c) { return c.tenant === p.tenant; }).length, archived: false });
      }
    });
    function group(name, required, min, max, opts) {
      var gr = { id: Orbis.nextId(db, 'MDG', 3), tenant: 't1', name: name, required: required, min: min, max: max, archived: false,
        options: opts.map(function (o) { return { id: Orbis.nextId(db, 'MDO', 4), name: o[0], price: o[1] }; }) };
      db.modifierGroups.push(gr); return gr.id;
    }
    var suhu = group('Suhu', true, 1, 1, [['Hot', 0], ['Iced', 0]]);
    var gula = group('Gula', true, 1, 1, [['Normal', 0], ['Less sugar', 0], ['No sugar', 0]]);
    var top = group('Topping', false, 0, 3, [['Extra shot', 6000], ['Oat milk', 8000], ['Boba', 5000]]);
    var attach = { p1: [suhu, gula, top], p2: [suhu, gula], p3: [suhu, gula, top], p7: [gula] };
    db.products.forEach(function (p) { if (attach[p.id]) p.modifierGroupIds = attach[p.id]; });
    db.skuOutlets.push({ tenant: 't1', skuId: 'k6', outlet: 'o2', price: 89000, available: true });   // Biji Kopi lebih mahal di BSD
  });

  /* ---------- demo: Large variant for Kopi Susu Awan (real domain call) ---------- */
  Orbis.demoHooks = Orbis.demoHooks || [];
  Orbis.demoHooks.push(function (x) {
    x.as('owner', 'Rina (Owner)', 'o1');
    var d = Orbis.db(), p1 = d.products.filter(function (p) { return p.id === 'p1'; })[0];
    if (!p1 || p1.tenant !== d.session.tenant) return;
    var skus = Orbis.mine(d, 'skus').filter(function (s) { return s.productId === 'p1'; });
    if (!skus.some(function (s) { return s.label === 'Large'; })) {
      x.at(x.now - 3 * x.HOUR, function () {
        C.updateProduct('p1', { name: p1.name, category: p1.category, skus: skus.map(function (s) { return { id: s.id, sku: s.sku, label: s.label, price: s.price, cost: s.cost, barcode: s.barcode }; })
          .concat([{ sku: 'KA-100L', label: 'Large', price: 34000, cost: 11500, barcode: '8991100', stock: 40 }]) });
      });
    }
    // ponytail: no demo orders with modifiers yet; demoHistory counts and reports tests assume none. Add via demo stats when sales exposes them.
  });
})(typeof window !== 'undefined' ? window : globalThis);
