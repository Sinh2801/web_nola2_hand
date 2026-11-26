/**
 * SEEDER 1000 SẢN PHẨM ĐỒ 2HAND (NOLA2HAND)
 *
 * Cách hoạt động:
 *  - Mỗi món có từ khóa tìm ảnh + danh sách tag BẮT BUỘC / LOẠI TRỪ.
 *  - Ảnh lấy từ Pixabay, chỉ giữ ảnh có tag khớp món đó, bỏ ảnh có người / ảnh lạc đề.
 *  - Mỗi sản phẩm chỉ dùng ảnh của đúng món nó mô tả, và luôn có 3-4 ảnh khác nhau.
 *  - Mô tả và tình trạng (condition) khớp nhau, giá theo từng món.
 *
 * Cần trong .env:
 *   MONGODB_URI=mongodb://localhost:27017/nola2hand
 *   PIXABAY_API_KEY=key_cua_ban
 *   DOWNLOAD_IMAGES=false     (true = tải ảnh về uploads/seed, xem hướng dẫn)
 *   IMAGE_BASE_URL=           (tùy chọn, ví dụ http://localhost:5000 khi DOWNLOAD_IMAGES=true)
 *
 * Yêu cầu Node >= 18.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

dotenv.config({ path: path.join(__dirname, '.env') });

const Product = require('./models/Product');
const User = require('./models/User');

// ==========================================
// CẤU HÌNH
// ==========================================
const PIXABAY_KEY = process.env.PIXABAY_API_KEY || '';
const DOWNLOAD_IMAGES = String(process.env.DOWNLOAD_IMAGES).toLowerCase() === 'true';
const IMAGE_BASE_URL = (process.env.IMAGE_BASE_URL || '').replace(/\/$/, '');
const TOTAL_PRODUCTS = 1000;
const POOL_SIZE = DOWNLOAD_IMAGES ? 12 : 25; // số ảnh tối đa giữ lại cho mỗi món
const MIN_IMAGES = 3; // mỗi sản phẩm có tối thiểu 3 ảnh
const MAX_IMAGES = 4; // và tối đa 4 ảnh
const MIN_POOL_WARN = 8; // cảnh báo nếu một món có ít hơn số ảnh này
const CACHE_FILE = path.join(__dirname, '.pixabay-cache.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // Pixabay yêu cầu cache 24h
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'seed');
// Thư viện ảnh đã tải: lưu tên file cho từng món, các lần chạy sau dùng lại, KHÔNG cần mạng / API key
const LIBRARY_FILE = path.join(UPLOAD_DIR, 'library.json');

// Ảnh có các tag này bị loại (muốn ảnh đồ vật, không phải ảnh người mẫu)
const PEOPLE_WORDS = [
    'woman', 'women', 'man', 'men', 'girl', 'boy', 'people', 'person', 'model',
    'portrait', 'child', 'children', 'kid', 'kids', 'baby', 'couple', 'family',
    'student', 'students', 'player', 'players', 'athlete', 'fashion', 'adult'
];

// ==========================================
// DANH MỤC MÓN HÀNG
//  query   : từ khóa tìm ảnh (tiếng Anh)
//  must    : ảnh phải có ít nhất 1 tag trong danh sách này
//  exclude : ảnh có tag trong danh sách này sẽ bị loại
//  price   : [min, max] đơn vị nghìn đồng
// ==========================================
const categoryData = {
    "Sách": [
        {
            name: "Giáo trình đại học", tag: "giáo trình", query: "textbook", price: [10, 60],
            must: ['textbook', 'book', 'books', 'library', 'study', 'education', 'school'],
            exclude: ['ebook', 'tablet', 'kindle', 'phone', 'cartoon', 'vector'],
            details: [
                "Đủ các chương, có ghi chú bút chì ở một số trang, rất tiện để ôn thi.",
                "Phù hợp bạn đang học các môn đại cương, giáo trình dùng lại được."
            ]
        },
        {
            name: "Từ điển và sách học tiếng Anh", tag: "sách tiếng anh", query: "dictionary", price: [15, 80],
            must: ['dictionary', 'book', 'books', 'english', 'language', 'learning'],
            exclude: ['ebook', 'tablet', 'kindle', 'phone', 'online'],
            details: [
                "Sách đầy đủ từ vựng và ngữ pháp, hợp luyện thi chứng chỉ hoặc học thêm.",
                "Nội dung dễ hiểu, hợp cho bạn tự học tiếng Anh tại nhà."
            ]
        },
        {
            name: "Combo sách đọc thêm", tag: "sách đọc", query: "books stack", price: [10, 50],
            must: ['book', 'books', 'novel', 'reading', 'library', 'literature'],
            exclude: ['ebook', 'tablet', 'kindle', 'phone', 'cartoon', 'vector'],
            details: [
                "Combo nhiều đầu sách đọc giải trí và phát triển bản thân, bán chung cho đỡ lẻ tẻ.",
                "Sách nằm trong tủ lâu, đọc xong không có chỗ để nên pass lại."
            ]
        }
    ],
    "Điện tử": [
        {
            name: "Laptop văn phòng", tag: "laptop", query: "laptop", price: [2500, 8000],
            must: ['laptop', 'notebook', 'computer'],
            exclude: ['tablet', 'phone', 'smartphone', 'ipad', 'vector'],
            details: [
                "Máy chạy ổn cho học online, Word, Excel và lập trình cơ bản.",
                "Máy dùng tốt cho sinh viên làm bài tập, xem phim, đã cài sẵn phần mềm cần thiết."
            ]
        },
        {
            name: "Chuột máy tính", tag: "chuột", query: "computer mouse", price: [30, 250],
            must: ['mouse', 'computer'],
            exclude: ['animal', 'rat', 'rodent', 'hamster', 'cat', 'pet', 'cheese', 'cute'],
            details: [
                "Chuột dùng cho laptop và PC đều được, cắm là chạy.",
                "Bấm êm, di chuyển mượt, hợp để học tập và làm việc văn phòng."
            ]
        },
        {
            name: "Bàn phím cơ", tag: "bàn phím", query: "mechanical keyboard", price: [150, 900],
            must: ['keyboard', 'keys', 'typing'],
            exclude: ['piano', 'music', 'synthesizer', 'musical'],
            details: [
                "Bàn phím cơ gõ sướng tay, phím đầy đủ, hợp cho lập trình và chơi game.",
                "Bàn phím gõ êm, các phím đều nhạy, dùng cổng kết nối thông dụng."
            ]
        },
        {
            name: "Cáp sạc điện thoại", tag: "cáp sạc", query: "charging cable", price: [20, 120],
            must: ['cable', 'cables', 'charger', 'usb', 'charging'],
            exclude: ['car', 'vehicle', 'ev', 'station', 'electric', 'tesla'],
            details: [
                "Cáp sạc dài, sạc nhanh ổn định, bán theo bộ cho tiện.",
                "Dọn phòng dư mấy sợi cáp còn dùng tốt, bán rẻ cho bạn nào cần."
            ]
        },
        {
            name: "Tai nghe", tag: "tai nghe", query: "headphones", price: [80, 600],
            must: ['headphone', 'headphones', 'headset', 'earphones', 'earbuds'],
            exclude: ['dj', 'studio', 'recording'],
            details: [
                "Tai nghe âm thanh rõ, đeo thoải mái, hợp nghe nhạc và học online.",
                "Có mic đàm thoại, dùng được cho cả điện thoại và laptop."
            ]
        },
        {
            name: "Loa bluetooth", tag: "loa", query: "bluetooth speaker", price: [100, 700],
            alt: ['wireless speaker', 'speaker'],
            must: ['speaker', 'speakers', 'bluetooth'],
            exclude: ['concert', 'party', 'dj', 'stage', 'festival'],
            details: [
                "Loa kết nối bluetooth dễ dàng, âm to rõ, hợp nghe nhạc trong phòng trọ.",
                "Loa nhỏ gọn mang theo được, pin dùng được vài giờ."
            ]
        },
        {
            name: "Sạc dự phòng", tag: "sạc dự phòng", query: "power bank", price: [100, 400],
            alt: ['portable charger', 'battery pack'],
            must: ['power bank', 'powerbank', 'charger', 'battery'],
            exclude: ['car', 'solar', 'plant', 'wind', 'nuclear'],
            details: [
                "Sạc dự phòng dung lượng lớn, sạc được nhiều lần cho điện thoại.",
                "Nhỏ gọn bỏ vừa balo, có cổng ra USB cho nhiều thiết bị."
            ]
        }
    ],
    "Quần áo": [
        {
            name: "Áo khoác", tag: "áo khoác", query: "jacket", price: [50, 300],
            alt: ['coat', 'windbreaker jacket', 'outerwear'],
            allowPeople: true,
            must: ['jacket', 'coat', 'windbreaker', 'clothing', 'clothes'],
            exclude: ['leather', 'fur', 'wedding', 'suit'],
            details: [
                "Áo khoác mặc đi học đi làm đều ổn, giữ ấm và chắn gió tốt.",
                "Form áo rộng thoải mái, dễ phối đồ."
            ]
        },
        {
            name: "Giày sneaker", tag: "giày", query: "sneakers", price: [100, 600],
            must: ['sneaker', 'sneakers', 'shoe', 'shoes', 'footwear'],
            exclude: ['heels', 'boots', 'sandals'],
            details: [
                "Giày đi êm chân, hợp đi học và đi chơi, đế còn bám tốt.",
                "Giày dễ phối đồ, đã vệ sinh sạch sẽ trước khi bán."
            ]
        },
        {
            name: "Balo", tag: "balo", query: "backpack", price: [60, 300],
            alt: ['school bag', 'rucksack', 'bag'],
            allowPeople: true,
            must: ['backpack', 'rucksack', 'bag', 'bags'],
            exclude: ['travel', 'hiking', 'mountain', 'tourist'],
            details: [
                "Balo nhiều ngăn, bỏ vừa laptop và sách vở, dây đeo chắc chắn.",
                "Balo đi học tiện dụng, khóa kéo còn chạy trơn tru."
            ]
        },
        {
            name: "Áo hoodie", tag: "hoodie", query: "hoodie", price: [50, 250],
            alt: ['sweatshirt', 'hooded sweatshirt', 'sweater'],
            allowPeople: true,
            must: ['hoodie', 'sweatshirt', 'sweater', 'clothing', 'clothes'],
            exclude: ['hacker', 'crime', 'anonymous'],
            details: [
                "Áo hoodie nỉ dày, mặc ấm, hợp đi học và đi chơi.",
                "Chất vải mềm, không xù lông, form rộng dễ mặc."
            ]
        },
        {
            name: "Quần jean", tag: "quần jean", query: "jeans", price: [60, 250],
            alt: ['denim', 'blue jeans', 'pants'],
            allowPeople: true,
            must: ['jeans', 'denim', 'pants', 'trousers', 'clothing'],
            exclude: ['sewing', 'factory', 'fabric'],
            details: [
                "Quần jean form đẹp, chất vải dày dặn, dễ phối với áo thun áo sơ mi.",
                "Quần mặc thoải mái, đường may còn chắc."
            ]
        }
    ],
    "Nội thất": [
        {
            name: "Bàn học gỗ", tag: "bàn học", query: "wooden table", price: [150, 800],
            must: ['table', 'desk'],
            exclude: ['food', 'restaurant', 'dinner', 'plate', 'laptop', 'computer', 'dining', 'wedding'],
            details: [
                "Bàn chắc chắn, mặt rộng, hợp học bài và làm việc trong phòng trọ.",
                "Bàn gỗ dễ lau chùi, kê vừa góc phòng nhỏ."
            ]
        },
        {
            name: "Đèn bàn học", tag: "đèn bàn", query: "desk lamp", price: [50, 300],
            must: ['lamp', 'lamps', 'light'],
            exclude: ['street', 'stage', 'christmas', 'festival', 'neon'],
            details: [
                "Đèn sáng đều, đỡ mỏi mắt khi học khuya, có thể chỉnh hướng sáng.",
                "Đèn nhỏ gọn, kẹp hoặc đặt bàn đều được."
            ]
        },
        {
            name: "Ghế xoay văn phòng", tag: "ghế", query: "office chair", price: [100, 600],
            must: ['chair', 'chairs'],
            exclude: ['dining', 'garden', 'beach', 'wedding', 'gaming'],
            details: [
                "Ghế xoay êm, nâng hạ được độ cao, ngồi học cả ngày không đau lưng.",
                "Ghế có bánh xe lăn mượt, hợp kê bàn học."
            ]
        },
        {
            name: "Kệ sách", tag: "kệ sách", query: "bookshelf", price: [150, 900],
            must: ['shelf', 'shelves', 'bookcase', 'bookshelf'],
            exclude: ['supermarket', 'store', 'shop', 'warehouse'],
            details: [
                "Kệ nhiều tầng, để được nhiều sách vở và đồ dùng cá nhân.",
                "Kệ chắc chắn, dễ tháo lắp khi chuyển trọ."
            ]
        },
        {
            name: "Quạt để bàn", tag: "quạt", query: "desk fan", price: [50, 250],
            alt: ['electric fan', 'table fan', 'fan'],
            must: ['fan', 'ventilator'],
            exclude: ['football', 'crowd', 'concert', 'fans', 'audience', 'sport', 'stadium', 'cooling'],
            details: [
                "Quạt chạy êm, gió mát, hợp để bàn học trong phòng trọ mùa nóng.",
                "Quạt nhỏ gọn, nhiều tốc độ gió."
            ]
        }
    ],
    "Văn phòng phẩm": [
        {
            name: "Sổ tay ghi chép", tag: "sổ tay", query: "notebook", price: [5, 50],
            must: ['notebook', 'notepad', 'diary', 'journal', 'paper'],
            exclude: ['laptop', 'computer', 'macbook', 'keyboard', 'tablet', 'phone'],
            details: [
                "Sổ còn nhiều trang trắng, giấy dày không lem mực.",
                "Sổ ghi chép bìa cứng, hợp ghi bài trên lớp và lên kế hoạch."
            ]
        },
        {
            name: "Bộ bút viết", tag: "bút", query: "pens", price: [5, 40],
            must: ['pen', 'pens', 'pencil', 'pencils', 'ballpoint', 'marker', 'markers', 'stationery'],
            exclude: ['sword', 'tattoo', 'animal'],
            details: [
                "Bộ bút còn dùng tốt, mực ra đều, nhiều màu để ghi chú.",
                "Bút viết êm tay, hợp ghi bài và đánh dấu tài liệu."
            ]
        },
        {
            name: "Máy tính cầm tay", tag: "máy tính", query: "calculator", price: [30, 250],
            alt: ['calculators', 'math calculator'],
            must: ['calculator', 'calculators'],
            exclude: ['finance', 'tax', 'bank'],
            details: [
                "Máy tính cầm tay bấm nhạy, đủ chức năng cho các môn tính toán.",
                "Màn hình hiển thị rõ, hợp mang đi thi."
            ]
        }
    ],
    "Thể thao": [
        {
            name: "Vợt cầu lông", tag: "vợt cầu lông", query: "badminton racket", price: [50, 500],
            alt: ['badminton', 'racket'],
            must: ['badminton', 'racket', 'racquet', 'shuttlecock'],
            exclude: ['tennis', 'squash', 'ping', 'table'],
            details: [
                "Vợt nhẹ tay, cân bằng tốt, hợp chơi phong trào cuối tuần.",
                "Vợt đã quấn cán sạch sẽ, dây còn căng."
            ]
        },
        {
            name: "Quả bóng đá", tag: "bóng đá", query: "soccer ball", price: [50, 250],
            must: ['ball', 'soccer', 'football'],
            exclude: ['american', 'rugby', 'stadium', 'match', 'goal', 'basketball', 'volleyball'],
            details: [
                "Bóng còn căng hơi tốt, đá sân cỏ nhân tạo ổn.",
                "Bóng size chuẩn, hợp đá phong trào với bạn bè."
            ]
        },
        {
            name: "Dây nhảy thể dục", tag: "dây nhảy", query: "jump rope", price: [20, 100],
            alt: ['skipping rope', 'rope'],
            must: ['rope', 'skipping', 'jump'],
            exclude: ['climbing', 'tug', 'bridge', 'ship', 'boat'],
            details: [
                "Dây nhảy tập cardio, chỉnh được độ dài, tay cầm chắc.",
                "Dây nhảy gọn nhẹ, mang theo tập ở đâu cũng được."
            ]
        },
        {
            name: "Tạ tay", tag: "tạ tay", query: "dumbbell", price: [50, 400],
            alt: ['weights', 'dumbbells'],
            must: ['dumbbell', 'dumbbells', 'weight', 'weights', 'barbell'],
            exclude: ['bodybuilder', 'muscle', 'gym'],
            details: [
                "Tạ tay tập tại nhà tiện lợi, bề mặt chống trơn.",
                "Tạ đủ cân nặng cho người mới tập, bán theo cặp."
            ]
        },
        {
            name: "Thảm tập yoga", tag: "thảm yoga", query: "yoga mat", price: [60, 300],
            alt: ['exercise mat', 'yoga', 'fitness mat'],
            must: ['yoga', 'mat', 'mats'],
            exclude: ['meditation', 'pose', 'doormat', 'carpet'],
            details: [
                "Thảm dày, chống trơn trượt, hợp tập yoga và gym tại nhà.",
                "Thảm dễ cuộn gọn, có dây đeo kèm theo."
            ]
        },
        {
            name: "Quả bóng rổ", tag: "bóng rổ", query: "basketball", price: [80, 400],
            must: ['basketball', 'ball'],
            exclude: ['nba', 'stadium', 'game', 'soccer', 'football', 'volleyball'],
            details: [
                "Bóng rổ độ nảy tốt, bề mặt còn nhám, ném bắt dễ.",
                "Bóng size chuẩn, chơi sân trong lẫn ngoài trời đều được."
            ]
        }
    ]
};

// ==========================================
// NỘI DUNG MÔ TẢ (khớp theo tình trạng)
// ==========================================
const CONDITIONS = [
    { value: 'Tốt', weight: 35 },
    { value: 'Khá', weight: 35 },
    { value: 'Đã dùng nhiều', weight: 22 },
    { value: 'Cần sửa chữa', weight: 8 }
];

const QUALITY_BY_CONDITION = {
    'Tốt': [
        "Còn rất mới, dùng ít, hoạt động bình thường.",
        "Ngoại hình gần như mới, mình giữ gìn kỹ."
    ],
    'Khá': [
        "Có vài vết xước nhẹ do dùng hằng ngày, không ảnh hưởng sử dụng.",
        "Dùng ổn định, chỉ hơi bụi, lau qua là sạch."
    ],
    'Đã dùng nhiều': [
        "Dùng khá lâu nên có dấu hiệu cũ, bù lại giá mềm.",
        "Ngoại hình cũ rõ nhưng vẫn dùng tốt, bạn nào cần đồ rẻ thì lấy."
    ],
    'Cần sửa chữa': [
        "Có lỗi nhỏ cần sửa nên mình để giá thấp, bạn xem kỹ trước khi mua nhé.",
        "Đồ còn lỗi nhẹ, mình ghi rõ để bạn cân nhắc, giá đã giảm nhiều."
    ]
};

const reasons = [
    "Sắp ra trường dọn trọ nên mình cần pass lại gấp.",
    "Mua dư không dùng tới nên thanh lý.",
    "Kẹt tiền đóng học phí nên đành pass lại.",
    "Dọn phòng thấy dư món này nên bán lại cho bạn nào cần."
];

const offers = [
    "Freeship quanh khu vực KTX.",
    "Có fix nhẹ cho bạn sinh viên nhiệt tình.",
    "Giao dịch trực tiếp tại cổng trường."
];

const prefixes = ["Thanh lý", "Pass nhanh", "Góc dọn trọ", "Bán rẻ"];
const locations = ['Campus', 'Dormitory', 'Nearby'];

// ==========================================
// TIỆN ÍCH
// ==========================================
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function weightedPick(list) {
    const total = list.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const x of list) {
        r -= x.weight;
        if (r <= 0) return x.value;
    }
    return list[0].value;
}

// Kiểm tra tag của ảnh: từ đơn so khớp nguyên từ, cụm từ (có dấu cách) so khớp chuỗi
function hasAny(tagsLower, wordSet, list) {
    return list.some((w) => (w.includes(' ') ? tagsLower.includes(w) : wordSet.has(w)));
}

// ==========================================
// PIXABAY + CACHE 24H
// ==========================================
let cache = {};
try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
} catch (_) {
    cache = {};
}

function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    } catch (_) { /* bỏ qua lỗi ghi cache */ }
}

async function fetchHits(query) {
    const c = cache[query];
    if (c && Date.now() - c.time < CACHE_TTL) return c.hits;
    if (!PIXABAY_KEY) throw new Error('thiếu PIXABAY_API_KEY');

    const params = new URLSearchParams({
        key: PIXABAY_KEY,
        q: query,
        image_type: 'photo',
        per_page: '200',
        safesearch: 'true',
        min_width: '500'
    });
    const res = await fetch(`https://pixabay.com/api/?${params}`);
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Pixabay ${res.status} ${body.slice(0, 80)}`);
    }
    const data = await res.json();
    const hits = (data.hits || []).map((h) => ({
        id: h.id,
        url: h.webformatURL,
        tags: h.tags || ''
    }));
    cache[query] = { time: Date.now(), hits };
    saveCache();
    return hits;
}

function filterHits(hits, item) {
    const seen = new Set();
    const result = [];
    for (const h of hits) {
        if (seen.has(h.id)) continue;
        seen.add(h.id);
        const tagsLower = h.tags.toLowerCase();
        const words = new Set(tagsLower.split(/[^a-z]+/).filter(Boolean));
        if (!hasAny(tagsLower, words, item.must)) continue;
        if (hasAny(tagsLower, words, item.exclude || [])) continue;
        if (!item.allowPeople && hasAny(tagsLower, words, PEOPLE_WORDS)) continue;
        result.push({ id: h.id, url: h.url });
        if (result.length >= POOL_SIZE) break;
    }
    return result;
}

// Gom ảnh cho một món: query chính trước, thiếu thì thử thêm query dự phòng (item.alt). Trả về [{ id, url }]
async function collectImages(item) {
    const queries = [item.query, ...(item.alt || [])];
    const found = [];
    const seen = new Set();
    for (const q of queries) {
        if (found.length >= POOL_SIZE) break;
        try {
            const hits = await fetchHits(q);
            for (const h of filterHits(hits, item)) {
                if (seen.has(h.id)) continue;
                seen.add(h.id);
                found.push(h);
                if (found.length >= POOL_SIZE) break;
            }
        } catch (e) {
            console.warn(`   ⚠️ Lỗi tìm ảnh "${q}" (${item.name}): ${e.message}`);
        }
    }
    return found;
}

// ==========================================
// THƯ VIỆN ẢNH LOCAL (tải 1 lần, dùng mãi)
// ==========================================
let library = {};
try {
    library = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
} catch (_) {
    library = {};
}

function saveLibrary() {
    try {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        fs.writeFileSync(LIBRARY_FILE, JSON.stringify(library, null, 1));
    } catch (_) { /* bỏ qua lỗi ghi thư viện */ }
}

// Đường dẫn lưu vào DB. IMAGE_BASE_URL để trống thì là đường dẫn tương đối /uploads/seed/xxx.jpg
const toPublic = (file) => `${IMAGE_BASE_URL}/uploads/seed/${file}`;

// Các file ảnh của một món còn tồn tại trên đĩa
function libraryGet(name) {
    return (library[name] || []).filter((f) => {
        try { return fs.statSync(path.join(UPLOAD_DIR, f)).size > 1024; } catch (_) { return false; }
    });
}

// Tải ảnh về uploads/seed. Tên file theo id Pixabay nên ổn định, đã có file thì không tải lại.
async function downloadImage(h) {
    const name = `pb-${h.id}.jpg`;
    const file = path.join(UPLOAD_DIR, name);
    try {
        if (fs.statSync(file).size > 1024) return name;
    } catch (_) { /* chưa có file */ }

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(h.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length < 1024) throw new Error('ảnh rỗng');
            fs.writeFileSync(file, buf);
            await sleep(150);
            return name;
        } catch (e) {
            if (attempt === 3) {
                console.warn(`     ⚠️ Không tải được ảnh ${h.id}: ${e.message}`);
                return null;
            }
            await sleep(500 * attempt);
        }
    }
    return null;
}

// Ảnh minh họa dạng SVG (lưu local) dùng khi không tải được ảnh thật, để sản phẩm không bao giờ bị vỡ ảnh
const CATEGORY_EMOJI = {
    'Sách': '📚', 'Điện tử': '💻', 'Quần áo': '👕', 'Nội thất': '🪑',
    'Văn phòng phẩm': '✏️', 'Thể thao': '🏀', 'Khác': '📦'
};
const slugify = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const xmlEscape = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function makePlaceholders(item, category) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const emoji = CATEGORY_EMOJI[category] || '📦';
    return [24, 200, 150, 280].map((hue, i) => {
        const name = `ph-${slugify(item.name)}-${i + 1}.svg`;
        const file = path.join(UPLOAD_DIR, name);
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file,
                `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">` +
                `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
                `<stop offset="0" stop-color="hsl(${hue} 85% 62%)"/><stop offset="1" stop-color="hsl(${hue + 30} 80% 45%)"/>` +
                `</linearGradient></defs><rect width="640" height="640" fill="url(#g)"/>` +
                `<text x="320" y="320" font-size="160" text-anchor="middle">${emoji}</text>` +
                `<text x="320" y="440" font-size="42" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif">${xmlEscape(item.name)}</text>` +
                `</svg>`);
        }
        return toPublic(name);
    });
}

// ==========================================
// SEEDER
// ==========================================
const runSeeder = async () => {
    try {
        if (!PIXABAY_KEY) {
            console.log('ℹ️ Không có PIXABAY_API_KEY: chỉ dùng ảnh đã tải sẵn trong uploads/seed, món nào thiếu sẽ dùng ảnh minh họa.');
        }

        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand');
        console.log('✅ Đã kết nối MongoDB thành công');

        // Chỉ dùng 20 user mới (23120001 -> 23120020@nlu.edu.vn); nếu chưa có thì dùng tất cả user
        let sellers = await User.find({ email: /^23120\d{3}@nlu\.edu\.vn$/ });
        if (sellers.length === 0) {
            console.log('⚠️ Chưa có user 23120xxx, chuyển sang dùng toàn bộ user trong DB.');
            sellers = await User.find();
        }
        if (sellers.length === 0) {
            console.log('❌ Lỗi: Database chưa có user nào! Chạy node createMultipleUsers.js trước.');
            process.exit(1);
        }
        console.log(`👥 Sẽ gán sản phẩm cho ${sellers.length} người bán`);
        const sellerCount = new Map(sellers.map((u) => [String(u._id), 0]));

        // 1. Tạo pool ảnh cho từng món, chỉ giữ ảnh khớp tag
        console.log('🔎 Đang tìm và lọc ảnh trên Pixabay...');
        const pools = [];
        for (const [category, items] of Object.entries(categoryData)) {
            for (const item of items) {
                let images = [];
                let fromLibrary = false;

                if (DOWNLOAD_IMAGES) {
                    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
                    let files = libraryGet(item.name);
                    if (files.length >= MIN_IMAGES) {
                        fromLibrary = true; // đã tải trước đó: không cần mạng
                    } else {
                        const hits = await collectImages(item);
                        files = [];
                        for (const h of hits) {
                            const f = await downloadImage(h);
                            if (f) files.push(f);
                        }
                        if (files.length >= MIN_IMAGES) {
                            library[item.name] = files;
                            saveLibrary();
                        }
                    }
                    if (files.length >= MIN_IMAGES) {
                        images = files.map(toPublic);
                    } else {
                        images = makePlaceholders(item, category);
                        console.log(`     🎨 Không tải được ảnh thật cho "${item.name}", dùng ảnh minh họa.`);
                    }
                } else {
                    images = (await collectImages(item)).map((h) => h.url);
                }

                const warn = images.length < MIN_POOL_WARN ? '  ⚠️ ít ảnh, nên đổi query' : '';
                console.log(`   • ${item.name}: ${images.length} ảnh${fromLibrary ? ' (thư viện local)' : ''}${warn}`);

                if (images.length >= MIN_IMAGES) {
                    pools.push({ category, item, images });
                } else {
                    console.log(`     ❌ Bỏ qua "${item.name}" vì chưa đủ ${MIN_IMAGES} ảnh khớp. Đổi query/must/exclude của món này rồi chạy lại.`);
                }
                if (!fromLibrary) await sleep(300);
            }
        }

        if (pools.length === 0) {
            console.log('❌ Không có ảnh nào hợp lệ. Kiểm tra mạng hoặc PIXABAY_API_KEY.');
            process.exit(1);
        }

        // 2. Xóa sản phẩm cũ và tạo mới
        console.log('🗑️ Đang xóa toàn bộ sản phẩm cũ...');
        await Product.deleteMany({});

        console.log(`⚙️ Đang tạo ${TOTAL_PRODUCTS} sản phẩm...`);
        const now = Date.now();
        const productsData = [];
        let sellerQueue = [];

        for (let i = 0; i < TOTAL_PRODUCTS; i++) {
            if (sellerQueue.length === 0) sellerQueue = shuffle(sellers);
            const seller = sellerQueue.pop();
            sellerCount.set(String(seller._id), sellerCount.get(String(seller._id)) + 1);

            const { category, item, images } = getRandomElement(pools);

            const title = Math.random() > 0.4
                ? `${getRandomElement(prefixes)} ${item.name}`
                : item.name;

            const condition = weightedPick(CONDITIONS);

            const parts = [`${item.name}.`];
            if (condition !== 'Cần sửa chữa') parts.push(getRandomElement(item.details));
            parts.push(getRandomElement(QUALITY_BY_CONDITION[condition]));
            parts.push(getRandomElement(reasons));
            parts.push(getRandomElement(offers));

            const rawPrice = getRandomInt(item.price[0], item.price[1]) * 1000;
            const price = Math.max(5000, Math.round(rawPrice / 5000) * 5000);

            const imageCount = getRandomInt(MIN_IMAGES, Math.min(MAX_IMAGES, images.length));
            const productImages = shuffle(images).slice(0, imageCount);

            productsData.push({
                userId: seller._id,
                title,
                description: parts.join(' '),
                price,
                category,
                condition,
                location: getRandomElement(locations),
                images: productImages,
                tags: [category.toLowerCase(), item.tag, 'pass đồ', 'sinh viên'],
                status: Math.random() > 0.15 ? 'Available' : 'Sold',
                isApproved: true,
                viewCount: getRandomInt(5, 200),
                favoriteCount: getRandomInt(0, 20),
                createdAt: new Date(now - getRandomInt(0, 45 * 24 * 60) * 60 * 1000)
            });
        }

        await Product.insertMany(productsData);

        const imgStats = { 3: 0, 4: 0 };
        productsData.forEach((p) => { imgStats[p.images.length] = (imgStats[p.images.length] || 0) + 1; });
        console.log(`\n🖼️  Số ảnh mỗi sản phẩm: 3 ảnh = ${imgStats[3]}, 4 ảnh = ${imgStats[4]}, sản phẩm có dưới ${MIN_IMAGES} ảnh = ${productsData.filter((p) => p.images.length < MIN_IMAGES).length}`);

        console.log('\n📊 Số sản phẩm mỗi người bán:');
        for (const u of sellers) {
            console.log(`   ${u.studentId || u.email}  ${u.name}: ${sellerCount.get(String(u._id))} sản phẩm`);
        }
        console.log(`\n✨ HOÀN THÀNH! Đã import ${productsData.length} sản phẩm.`);
        console.log(`   Số món có ảnh: ${pools.length}/${Object.values(categoryData).flat().length}`);
        process.exit(0);
    } catch (error) {
        console.error('\n❌ LỖI:', error.message);
        process.exit(1);
    }
};

runSeeder();