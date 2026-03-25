/* emoji_db.js
 * 手改友善：你平常只需要改 DATA.order + DATA.packs（新增類別/調整內容）
 *
 * 用法：
 *   EMOJI_DB("fruits") -> 回傳 fruits 類別的 entries[]
 *   EMOJI_DB(1)        -> 回傳第 1 類（依 DATA.order；1-based）
 *   EMOJI_DB(0)        -> 回傳第 1 類（0-based alias）
 *   EMOJI_DB.keys()    -> 依順序列出所有類別 key
 *   EMOJI_DB.key(1)    -> 取第 1 類的 key
 *   EMOJI_DB.validate() -> 檢查每包是否 20 個、key 是否重複、欄位是否齊
 */

const DATA = {
  // ✅ 類別順序（數字索引就靠這裡）
  order: [
    "fruits",
    "land_animals",
    "birds",
    "marine_animals",
    "land_transport",
    "air_travel",
  ],

  // ✅ 類別內容（每類 20 筆）
  // 欄位固定：k/u/zh/py/en/vi
  packs: {
    // 01) Fruits (20)
    fruits: [
      { k: "apple_red", u: "🍎", zh: "紅蘋果", py: "hóng píngguǒ", en: "red apple", vi: "táo đỏ" },
      { k: "apple_green", u: "🍏", zh: "青蘋果", py: "qīng píngguǒ", en: "green apple", vi: "táo xanh" },
      { k: "banana", u: "🍌", zh: "香蕉", py: "xiāngjiāo", en: "banana", vi: "chuối" },
      { k: "grapes", u: "🍇", zh: "葡萄", py: "pútao", en: "grapes", vi: "nho" },
      { k: "orange", u: "🍊", zh: "橙子", py: "chéngzi", en: "orange", vi: "cam" },
      { k: "pear", u: "🍐", zh: "梨子", py: "lízi", en: "pear", vi: "lê" },
      { k: "peach", u: "🍑", zh: "桃子", py: "táozi", en: "peach", vi: "đào" },
      { k: "cherries", u: "🍒", zh: "櫻桃", py: "yīngtáo", en: "cherries", vi: "anh đào" },
      { k: "strawberry", u: "🍓", zh: "草莓", py: "cǎoméi", en: "strawberry", vi: "dâu tây" },
      { k: "pineapple", u: "🍍", zh: "鳳梨", py: "fènglí", en: "pineapple", vi: "dứa" },
      { k: "watermelon", u: "🍉", zh: "西瓜", py: "xīguā", en: "watermelon", vi: "dưa hấu" },
      { k: "melon", u: "🍈", zh: "甜瓜", py: "tiánguā", en: "melon", vi: "dưa lưới" },
      { k: "kiwi", u: "🥝", zh: "奇異果", py: "qíyìguǒ", en: "kiwi", vi: "kiwi" },
      { k: "lemon", u: "🍋", zh: "檸檬", py: "níngméng", en: "lemon", vi: "chanh" },
      { k: "mango", u: "🥭", zh: "芒果", py: "mángguǒ", en: "mango", vi: "xoài" },
      { k: "blueberry", u: "🫐", zh: "藍莓", py: "lánméi", en: "blueberry", vi: "việt quất" },
      { k: "coconut", u: "🥥", zh: "椰子", py: "yēzi", en: "coconut", vi: "dừa" },
      { k: "tomato", u: "🍅", zh: "番茄", py: "fānqié", en: "tomato", vi: "cà chua" },
      { k: "avocado", u: "🥑", zh: "酪梨", py: "luòlí", en: "avocado", vi: "bơ" },
      { k: "olive", u: "🫒", zh: "橄欖", py: "gǎnlǎn", en: "olive", vi: "ô liu" },
    ],

    // 02) Land Animals (20)｜陸地生物
    land_animals: [
      { k: "dog", u: "🐶", zh: "狗", py: "gǒu", en: "dog", vi: "chó" },
      { k: "cat", u: "🐱", zh: "貓", py: "māo", en: "cat", vi: "mèo" },
      { k: "mouse", u: "🐭", zh: "老鼠", py: "lǎoshǔ", en: "mouse", vi: "chuột" },
      { k: "hamster", u: "🐹", zh: "倉鼠", py: "cāngshǔ", en: "hamster", vi: "chuột hamster" },
      { k: "rabbit", u: "🐰", zh: "兔子", py: "tùzi", en: "rabbit", vi: "thỏ" },
      { k: "fox", u: "🦊", zh: "狐狸", py: "húli", en: "fox", vi: "cáo" },
      { k: "bear", u: "🐻", zh: "熊", py: "xióng", en: "bear", vi: "gấu" },
      { k: "panda", u: "🐼", zh: "熊貓", py: "xióngmāo", en: "panda", vi: "gấu trúc" },
      { k: "koala", u: "🐨", zh: "無尾熊", py: "wúwěixióng", en: "koala", vi: "koala" },
      { k: "tiger", u: "🐯", zh: "老虎", py: "lǎohǔ", en: "tiger", vi: "hổ" },
      { k: "lion", u: "🦁", zh: "獅子", py: "shīzi", en: "lion", vi: "sư tử" },
      { k: "cow", u: "🐮", zh: "牛", py: "niú", en: "cow", vi: "bò" },
      { k: "pig", u: "🐷", zh: "豬", py: "zhū", en: "pig", vi: "heo" },
      { k: "frog", u: "🐸", zh: "青蛙", py: "qīngwā", en: "frog", vi: "ếch" },
      { k: "monkey", u: "🐵", zh: "猴子", py: "hóuzi", en: "monkey", vi: "khỉ" },
      { k: "horse", u: "🐴", zh: "馬", py: "mǎ", en: "horse", vi: "ngựa" },
      { k: "deer", u: "🦌", zh: "鹿", py: "lù", en: "deer", vi: "nai" },
      { k: "camel", u: "🐪", zh: "駱駝", py: "luòtuo", en: "camel", vi: "lạc đà" },
      { k: "llama", u: "🦙", zh: "羊駝", py: "yángtuo", en: "llama", vi: "lama" },
      { k: "elephant", u: "🐘", zh: "大象", py: "dàxiàng", en: "elephant", vi: "voi" },
    ],

    // 03) Birds (20)｜鳥類
    birds: [
      { k: "bird", u: "🐦", zh: "鳥", py: "niǎo", en: "bird", vi: "chim" },
      { k: "penguin", u: "🐧", zh: "企鵝", py: "qǐ'é", en: "penguin", vi: "chim cánh cụt" },
      { k: "dove", u: "🕊️", zh: "鴿子", py: "gēzi", en: "dove", vi: "chim bồ câu" },
      { k: "eagle", u: "🦅", zh: "老鷹", py: "lǎoyīng", en: "eagle", vi: "đại bàng" },
      { k: "duck", u: "🦆", zh: "鴨子", py: "yāzi", en: "duck", vi: "vịt" },
      { k: "owl", u: "🦉", zh: "貓頭鷹", py: "māotóuyīng", en: "owl", vi: "cú" },
      { k: "swan", u: "🦢", zh: "天鵝", py: "tiān'é", en: "swan", vi: "thiên nga" },
      { k: "parrot", u: "🦜", zh: "鸚鵡", py: "yīngwǔ", en: "parrot", vi: "vẹt" },
      { k: "flamingo", u: "🦩", zh: "紅鶴", py: "hónghè", en: "flamingo", vi: "hồng hạc" },
      { k: "peacock", u: "🦚", zh: "孔雀", py: "kǒngquè", en: "peacock", vi: "công" },
      { k: "rooster", u: "🐓", zh: "公雞", py: "gōngjī", en: "rooster", vi: "gà trống" },
      { k: "chicken", u: "🐔", zh: "雞", py: "jī", en: "chicken", vi: "gà" },
      { k: "chick", u: "🐤", zh: "小雞", py: "xiǎojī", en: "chick", vi: "gà con" },
      { k: "hatching_chick", u: "🐣", zh: "破殼小雞", py: "pòké xiǎojī", en: "hatching chick", vi: "gà con mới nở" },
      { k: "baby_chick", u: "🐥", zh: "小雞（正面）", py: "xiǎojī", en: "baby chick", vi: "gà con" },
      { k: "turkey", u: "🦃", zh: "火雞", py: "huǒjī", en: "turkey", vi: "gà tây" },
      { k: "dodo", u: "🦤", zh: "渡渡鳥", py: "dùdùniǎo", en: "dodo", vi: "chim dodo" },
      { k: "goose", u: "🪿", zh: "鵝", py: "é", en: "goose", vi: "ngỗng" },
      { k: "black_bird", u: "🐦‍⬛", zh: "黑鳥", py: "hēiniǎo", en: "black bird", vi: "chim đen" },
      { k: "feather", u: "🪶", zh: "羽毛", py: "yǔmáo", en: "feather", vi: "lông vũ" },
    ],

    // 04) Marine Animals (20)｜海洋生物
    marine_animals: [
      { k: "fish", u: "🐟", zh: "魚", py: "yú", en: "fish", vi: "cá" },
      { k: "tropical_fish", u: "🐠", zh: "熱帶魚", py: "rèdài yú", en: "tropical fish", vi: "cá nhiệt đới" },
      { k: "blowfish", u: "🐡", zh: "河豚", py: "hétún", en: "blowfish", vi: "cá nóc" },
      { k: "shark", u: "🦈", zh: "鯊魚", py: "shāyú", en: "shark", vi: "cá mập" },
      { k: "dolphin", u: "🐬", zh: "海豚", py: "hǎitún", en: "dolphin", vi: "cá heo" },
      { k: "whale", u: "🐋", zh: "鯨魚", py: "jīngyú", en: "whale", vi: "cá voi" },
      { k: "spouting_whale", u: "🐳", zh: "噴水鯨", py: "pēnshuǐ jīng", en: "spouting whale", vi: "cá voi phun nước" },
      { k: "seal", u: "🦭", zh: "海豹", py: "hǎibào", en: "seal", vi: "hải cẩu" },
      { k: "octopus", u: "🐙", zh: "章魚", py: "zhāngyú", en: "octopus", vi: "bạch tuộc" },
      { k: "squid", u: "🦑", zh: "魷魚", py: "yóuyú", en: "squid", vi: "mực" },
      { k: "crab", u: "🦀", zh: "螃蟹", py: "pángxiè", en: "crab", vi: "cua" },
      { k: "lobster", u: "🦞", zh: "龍蝦", py: "lóngxiā", en: "lobster", vi: "tôm hùm" },
      { k: "shrimp", u: "🦐", zh: "蝦子", py: "xiāzi", en: "shrimp", vi: "tôm" },
      { k: "jellyfish", u: "🪼", zh: "水母", py: "shuǐmǔ", en: "jellyfish", vi: "sứa" },
      { k: "shell", u: "🐚", zh: "貝殼", py: "bèiké", en: "shell", vi: "vỏ sò" },
      { k: "coral", u: "🪸", zh: "珊瑚", py: "shānhú", en: "coral", vi: "san hô" },
      { k: "sea_turtle", u: "🐢", zh: "海龜", py: "hǎiguī", en: "sea turtle", vi: "rùa biển" },
      { k: "otter", u: "🦦", zh: "水獺", py: "shuǐtǎ", en: "otter", vi: "rái cá" },
      { k: "oyster", u: "🦪", zh: "牡蠣", py: "mǔlì", en: "oyster", vi: "hàu" },
      { k: "snail", u: "🐌", zh: "蝸牛", py: "wōniú", en: "snail", vi: "ốc sên" },
    ],

    // 05) Land Transport (20)｜陸地交通
    land_transport: [
      { k: "car", u: "🚗", zh: "汽車", py: "qìchē", en: "car", vi: "ô tô" },
      { k: "taxi", u: "🚕", zh: "計程車", py: "jìchéngchē", en: "taxi", vi: "taxi" },
      { k: "suv", u: "🚙", zh: "休旅車", py: "xiūlǚchē", en: "SUV", vi: "xe SUV" },
      { k: "bus", u: "🚌", zh: "公車", py: "gōngchē", en: "bus", vi: "xe buýt" },
      { k: "trolleybus", u: "🚎", zh: "無軌電車", py: "wúguǐ diànchē", en: "trolleybus", vi: "xe trolleybus" },
      { k: "race_car", u: "🏎️", zh: "賽車", py: "sàichē", en: "race car", vi: "xe đua" },
      { k: "police_car", u: "🚓", zh: "警車", py: "jǐngchē", en: "police car", vi: "xe cảnh sát" },
      { k: "ambulance", u: "🚑", zh: "救護車", py: "jiùhùchē", en: "ambulance", vi: "xe cứu thương" },
      { k: "fire_engine", u: "🚒", zh: "消防車", py: "xiāofángchē", en: "fire engine", vi: "xe cứu hỏa" },
      { k: "minibus", u: "🚐", zh: "小巴", py: "xiǎobā", en: "minibus", vi: "xe minibus" },
      { k: "truck", u: "🚚", zh: "貨車", py: "huòchē", en: "truck", vi: "xe tải" },
      { k: "semi_truck", u: "🚛", zh: "聯結卡車", py: "liánjié kǎchē", en: "semi-truck", vi: "xe đầu kéo" },
      { k: "tractor", u: "🚜", zh: "拖拉機", py: "tuōlājī", en: "tractor", vi: "máy kéo" },
      { k: "motorcycle", u: "🏍️", zh: "摩托車", py: "mótuōchē", en: "motorcycle", vi: "xe máy" },
      { k: "scooter", u: "🛵", zh: "速克達", py: "sùkèdá", en: "scooter", vi: "xe tay ga" },
      { k: "bicycle", u: "🚲", zh: "自行車", py: "zìxíngchē", en: "bicycle", vi: "xe đạp" },
      { k: "kick_scooter", u: "🛴", zh: "滑板車", py: "huábǎnchē", en: "kick scooter", vi: "xe scooter" },
      { k: "skateboard", u: "🛹", zh: "滑板", py: "huábǎn", en: "skateboard", vi: "ván trượt" },
      { k: "train", u: "🚂", zh: "火車", py: "huǒchē", en: "train", vi: "tàu hỏa" },
      { k: "metro", u: "🚇", zh: "地鐵", py: "dìtiě", en: "subway", vi: "tàu điện ngầm" },
    ],

    // 06) Air Travel (20)｜飛行交通（載具＋機場流程）
    air_travel: [
      { k: "airplane", u: "✈️", zh: "飛機", py: "fēijī", en: "airplane", vi: "máy bay" },
      { k: "small_airplane", u: "🛩️", zh: "小型飛機", py: "xiǎoxíng fēijī", en: "small airplane", vi: "máy bay nhỏ" },
      { k: "takeoff", u: "🛫", zh: "起飛", py: "qǐfēi", en: "takeoff", vi: "cất cánh" },
      { k: "landing", u: "🛬", zh: "降落", py: "jiàngluò", en: "landing", vi: "hạ cánh" },
      { k: "helicopter", u: "🚁", zh: "直升機", py: "zhíshēngjī", en: "helicopter", vi: "máy bay trực thăng" },
      { k: "rocket", u: "🚀", zh: "火箭", py: "huǒjiàn", en: "rocket", vi: "tên lửa" },
      { k: "satellite", u: "🛰️", zh: "衛星", py: "wèixīng", en: "satellite", vi: "vệ tinh" },
      { k: "parachute", u: "🪂", zh: "降落傘", py: "jiàngluòsǎn", en: "parachute", vi: "dù" },
      { k: "ticket", u: "🎫", zh: "機票", py: "jīpiào", en: "ticket", vi: "vé" },
      { k: "luggage", u: "🧳", zh: "行李", py: "xínglǐ", en: "luggage", vi: "hành lý" },
      { k: "passport_control", u: "🛂", zh: "護照查驗", py: "hùzhào cháyàn", en: "passport control", vi: "kiểm soát hộ chiếu" },
      { k: "baggage_claim", u: "🛄", zh: "行李提領", py: "xínglǐ tílǐng", en: "baggage claim", vi: "nhận hành lý" },
      { k: "customs", u: "🛃", zh: "海關", py: "hǎiguān", en: "customs", vi: "hải quan" },
      { k: "left_luggage", u: "🛅", zh: "行李寄存", py: "xínglǐ jìcún", en: "left luggage", vi: "gửi hành lý" },
      { k: "seat", u: "💺", zh: "座位", py: "zuòwèi", en: "seat", vi: "ghế" },
      { k: "pilot", u: "🧑‍✈️", zh: "飛行員", py: "fēixíngyuán", en: "pilot", vi: "phi công" },
      { k: "map", u: "🗺️", zh: "地圖", py: "dìtú", en: "map", vi: "bản đồ" },
      { k: "compass", u: "🧭", zh: "羅盤", py: "luópán", en: "compass", vi: "la bàn" },
      { k: "clock", u: "🕒", zh: "時鐘", py: "shízhōng", en: "clock", vi: "đồng hồ" },
      { k: "confirm", u: "✅", zh: "確認", py: "quèrèn", en: "confirm", vi: "xác nhận" },
    ],
  },
};

// -------------------------
// Selector (thin wrapper)
// -------------------------
export function EMOJI_DB(selector) {
  // by key
  if (typeof selector === "string") {
    return DATA.packs[selector] || null;
  }

  // by index (1-based, allow 0-based alias)
  if (typeof selector === "number" && Number.isFinite(selector)) {
    const idx = selector === 0 ? 0 : selector - 1;
    const key = DATA.order[idx];
    return key ? (DATA.packs[key] || null) : null;
  }

  return null;
}

// utilities
EMOJI_DB.keys = () => [...DATA.order];
EMOJI_DB.key = (index) => {
  const idx = index === 0 ? 0 : index - 1;
  return DATA.order[idx] || null;
};
EMOJI_DB.raw = () => DATA;

// optional validation (貼紙系統對齊：每包 20)
EMOJI_DB.validate = (expectedSize = 20) => {
  const errors = [];
  for (const key of DATA.order) {
    const arr = DATA.packs[key];
    if (!Array.isArray(arr)) {
      errors.push(`[${key}] is missing or not an array`);
      continue;
    }
    if (arr.length !== expectedSize) errors.push(`[${key}] must have ${expectedSize}, got ${arr.length}`);

    const set = new Set();
    for (const e of arr) {
      if (!e?.k || !e?.u) errors.push(`[${key}] entry missing k/u: ${JSON.stringify(e)}`);
      if (set.has(e.k)) errors.push(`[${key}] duplicate k: ${e.k}`);
      set.add(e.k);
      for (const f of ["zh", "py", "en", "vi"]) {
        if (!e[f] || String(e[f]).trim() === "") errors.push(`[${key}] ${e.k} missing ${f}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
};
