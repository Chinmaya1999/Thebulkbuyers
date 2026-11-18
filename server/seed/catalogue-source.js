/* The Bulk Buyers — catalogue & config. Edit freely.
   NOTE: prices/MOQs are indicative sample values — replace with your real numbers. */
window.TBB = {
  brand: {
    name: 'The Bulk Buyers',
    phone: '+91 00000 00000',
    whatsapp: '910000000000',          // country code + number, no "+"
    email: 'hello@thebulkbuyers.com',
    address: 'Your Office Address, City, State, India'
  },
  categories: [
    { id:'tees',    name:'T-Shirts & Polos',     icon:'tee',    c:'#ff5a2c', blurb:'Combed cotton, pique, performance knits' },
    { id:'fleece',  name:'Fleece & Hoodies',     icon:'hoodie', c:'#7a5cff', blurb:'Hoodies, sweatshirts, joggers' },
    { id:'denim',   name:'Denim & Bottoms',      icon:'jeans',  c:'#2f6fff', blurb:'Jeans, cargos, chinos, shorts' },
    { id:'shirts',  name:'Shirts & Woven',       icon:'shirt',  c:'#18c29c', blurb:'Oxford, linen, uniform shirts' },
    { id:'outer',   name:'Jackets & Outerwear',  icon:'jacket', c:'#ffb347', blurb:'Varsity, puffer, bomber, windcheaters' },
    { id:'women',   name:'Womenswear & Kids',    icon:'dress',  c:'#ff4f9a', blurb:'Kurtis, dresses, leggings, kidswear' },
    { id:'work',    name:'Uniforms & Workwear',  icon:'shirt',  c:'#8aa0b4', blurb:'Corporate, medical, industrial' },
    { id:'active',  name:'Activewear',           icon:'shorts', c:'#c6ff3d', blurb:'Dry-fit tees, track sets, gym shorts' }
  ],
  products: [
    // slug, name, cat, icon, fabric, gsm, fit, moq, [minPrice,maxPrice] USD/pc, lead days, colors
    p('classic-crew-neck-tee','Classic Crew Neck T-Shirt','tees','tee','100% Combed Cotton Single Jersey',180,'Regular',500,[110,165],25,['#f4f1ea','#111','#1f3a5f','#b3262d','#2f6b4f'],'Bio-washed, pre-shrunk, ring-spun yarn. The everyday bulk best-seller for retail & merch.'),
    p('oversized-drop-shoulder-tee','Oversized Drop-Shoulder Tee','tees','tee','100% Cotton Terry Jersey',240,'Oversized',300,[190,280],28,['#e9dcc5','#222','#7a8f6d','#c9c2d8'],'Heavyweight boxy streetwear tee with puff & screen-print ready fabric.'),
    p('pique-polo-shirt','Pique Polo Shirt','tees','polo','Cotton Pique',220,'Regular',500,[170,260],28,['#fff','#0b1f3a','#111','#8b1e2d','#1b5e46'],'Corporate & golf polo with ribbed collar, 2-button placket and embroidery-ready chest.'),
    p('dry-fit-performance-tee','Dry-Fit Performance Tee','active','tee','Polyester Micro-Mesh',140,'Athletic',500,[95,150],22,['#ff5a2c','#111','#2f6fff','#c6ff3d'],'Moisture-wicking, quick-dry, anti-odour finish for gyms, teams and events.'),
    p('henley-full-sleeve-tee','Henley Full Sleeve Tee','tees','tee','Cotton Slub Jersey',200,'Slim',400,[160,240],26,['#d8cfbf','#35403a','#2a2a2e'],'Three-button henley with textured slub fabric and garment wash.'),
    p('pullover-hoodie','Pullover Hoodie','fleece','hoodie','Cotton-Poly Brushed Fleece',320,'Regular',300,[310,470],30,['#111','#6b6b70','#e8dcc8','#1f3a5f','#7a1f2b'],'Kangaroo pocket, double-layer hood, ribbed cuffs. Perfect for winter drops and merch.'),
    p('zipper-hoodie','Zipper Hoodie','fleece','hoodie','Cotton Fleece',350,'Regular',300,[360,540],32,['#111','#444','#0b2a4a','#2f4f3a'],'Full-zip with metal YKK-style zipper, kangaroo pockets and inner brushed lining.'),
    p('crew-sweatshirt','Crew Neck Sweatshirt','fleece','hoodie','French Terry Cotton',300,'Regular',400,[260,380],30,['#cfc7bb','#111','#5b6b8c','#a14a3a'],'Classic crew with rib-knit trims, loop-back terry inside.'),
    p('jogger-track-pants','Jogger Track Pants','fleece','jeans','Cotton Fleece',260,'Tapered',400,[230,340],28,['#111','#555','#1f3a5f'],'Elastic waist, drawcord, zipped pockets, tapered cuffs.'),
    p('slim-fit-stretch-jeans','Slim Fit Stretch Jeans','denim','jeans','98% Cotton 2% Elastane Denim',12,'Slim',300,[380,620],38,['#27406b','#111a2c','#6f8fb5','#222'],'12 oz stretch denim, stone / enzyme wash options, 5-pocket. Prices per pc FOB.'),
    p('cargo-pants-six-pocket','Six-Pocket Cargo Pants','denim','jeans','Cotton Twill',280,'Relaxed',300,[330,520],34,['#6b6a4a','#111','#b9a888','#3c4a3a'],'Utility cargo with bellows pockets and adjustable hem drawcords.'),
    p('stretch-chino-trousers','Stretch Chino Trousers','denim','jeans','Cotton Elastane Twill',240,'Slim',300,[300,460],32,['#c8b58a','#1f2b44','#2b2b2b','#6f6a58'],'Smart-casual flat-front chino with stretch comfort.'),
    p('oxford-button-down-shirt','Oxford Button-Down Shirt','shirts','shirt','Cotton Oxford',150,'Regular',400,[250,390],32,['#cfe1f2','#fff','#f0d9d9','#1f3a5f'],'Button-down collar, chest pocket, durable oxford weave.'),
    p('linen-blend-shirt','Linen Blend Shirt','shirts','shirt','55% Linen 45% Cotton',140,'Relaxed',300,[330,520],34,['#e6dcc6','#9fb8a8','#fff','#7d8aa6'],'Breathable summer weave with natural texture and mother-of-pearl style buttons.'),
    p('corporate-uniform-shirt','Corporate Uniform Shirt','work','shirt','Poly-Cotton Blend',120,'Regular',500,[210,330],30,['#fff','#cfe1f2','#d8d8d8','#1f3a5f'],'Wrinkle-resistant, easy-care uniform shirt for banks, airlines & hospitality.'),
    p('varsity-baseball-jacket','Varsity Baseball Jacket','outer','jacket','Wool-Blend Body + Leatherette Sleeve',480,'Boxy',200,[780,1250],40,['#7a1f2b','#0b1f3a','#111','#2f4f3a'],'Snap buttons, rib trims, chenille / embroidery patch ready.'),
    p('quilted-puffer-jacket','Quilted Puffer Jacket','outer','jacket','Nylon Shell + Poly Fill',180,'Regular',200,[820,1350],42,['#111','#c9b79a','#2b3f5c','#d44a2a'],'Lightweight water-resistant puffer, stand collar, zip pockets.'),
    p('windcheater-bomber-jacket','Windcheater Bomber Jacket','outer','jacket','Polyester Taslan',120,'Regular',250,[520,860],36,['#111','#2f6fff','#ff5a2c','#6f6a58'],'Packable, wind-resistant, mesh lined — promotional & retail favourite.'),
    p('cotton-straight-kurti','Cotton Straight Kurti','women','dress','Cotton Cambric Print',130,'Straight',300,[220,420],28,['#c94a6b','#2f7a6b','#e6b34a','#5b4aa8'],'Block / digital print, 3/4 sleeve, side slits. Jaipur-style prints on request.'),
    p('rayon-maxi-dress','Rayon Maxi Dress','women','dress','Viscose Rayon',110,'A-Line',250,[360,640],34,['#d8618a','#2e6f9e','#e8a33d','#111'],'Flowy summer maxi with tie waist and printed panels.'),
    p('kids-tee-and-shorts-set','Kids Tee & Shorts Set','women','tee','Cotton Single Jersey',160,'Regular',600,[140,230],26,['#ffb347','#7ee0c3','#6fa8ff','#ff8fb3'],'Soft, safe-dye kidswear co-ord set, sizes 2–12 years.'),
    p('four-way-stretch-leggings','Four-Way Stretch Leggings','women','jeans','Nylon Spandex Blend',220,'Skinny',400,[170,320],28,['#111','#3a2a5c','#1f3a5f','#7a1f2b'],'High-waist, squat-proof, flat-lock seams. Yoga & gym ready.'),
    p('industrial-coverall','Industrial Coverall','work','jacket','Cotton Drill',240,'Relaxed',200,[520,880],35,['#1f3a5f','#c2571a','#3c4a3a','#8a8a8a'],'Heavy-duty drill coverall with reflective tape and double stitching.'),
    p('medical-scrub-set','Medical Scrub Set','work','shirt','Poly-Cotton Stretch',150,'Regular',300,[320,520],30,['#2a6f7a','#1f3a5f','#7a1f4a','#111'],'Antimicrobial-finish scrub top & pant with multi-pockets.'),
    p('gym-training-shorts','Gym Training Shorts','active','shorts','Poly Micro-Interlock',130,'Athletic',500,[110,190],24,['#111','#2f6fff','#c6ff3d','#ff5a2c'],'Lightweight shorts with zipped pocket, inner brief option and reflective logo spot.')
  ],
  markets: ['USA','UK','UAE','Saudi Arabia','Germany','France','Australia','Canada','South Africa','Nigeria','Kenya','Singapore']
};
function p(slug,name,cat,icon,fabric,gsm,fit,moq,price,lead,colors,desc){
  return {slug,name,cat,icon,fabric,gsm,fit,moq,price,lead,colors,desc,
    sizes: cat==='women'&&slug.includes('kids')?'2Y–12Y':'S–3XL',
    unit: gsm<30?'oz':'GSM'};
}
