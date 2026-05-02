# RULE: no-scope-creep

**Áp dụng tuyệt đối cho mọi response liên quan đến implementation.**
Claude không được tự ý implement hoặc đề xuất implement bất kỳ thứ gì nằm ngoài danh sách IN Scope của PRD V5.

---

## 1. OUT OF SCOPE — Cấm vĩnh viễn

Không bao giờ implement, gợi ý, hay viết code liên quan đến:

| # | Item | Thay thế hợp lệ |
|---|------|-----------------|
| 1 | ML/AI models (LSTM, GRU, PyTorch, TensorFlow, Vector DB, Pinecone, Weaviate, embeddings) | Rule Engine + Redis weights |
| 2 | Collaborative Filtering | Phase 2 — không có trong MVP |
| 3 | Bloom Filter | Redis SET cho dedup |
| 4 | gRPC full internal mesh | REST hoặc Kafka (trừ 2 calls được phép) |
| 5 | DRM (Digital Rights Management) | Pre-signed URL + CDN |
| 6 | Mobile App (iOS / Android) | Web SPA (React) |
| 7 | Payment Gateway / Premium Subscription | Không có alternative trong Phase 1 |
| 8 | Train AI models from scratch | Không có alternative trong Phase 1 |

**Ví dụ:**
- KHÔNG được: `pip install torch` / `from sklearn.neighbors import ...` / `import numpy as np` (cho matrix ops)
- ĐƯỢC: `redis.zadd("trending:...", score, song_id)` / Rule Engine scoring function

---

## 2. PHASE 2 ONLY — Không implement trong Phase 1

Nếu được hỏi về các tính năng dưới đây, phải trả lời:
> "Tính năng này thuộc Phase 2 — chưa implement trong Phase 1 MVP."

- **Collaborative Filtering** (bất kỳ dạng nào)
- **Host re-election** khi Host disconnect trong Listening Party

**Ví dụ:**
- KHÔNG được: implement user-user similarity, item-item CF, matrix factorization
- KHÔNG được: tự động chuyển Host sang Member khi Host ngắt kết nối
- ĐƯỢC: Rule Engine recommendation + thông báo "Listening Party kết thúc khi Host disconnect"

---

## 3. Recommendation Service — Constraint cứng

Recommendation Service **CHỈ ĐƯỢC** dùng:

```
final_score = base_score
            + context_bonus      # time_of_day, mood_tag
            + preference_bonus   # genre/artist weights từ Redis Hash
            - skip_penalty       # từ Song_Skipped events
```

- Redis Sorted Set: Trending (`ZADD`, `ZREVRANGE`)
- Redis Hash: user preference weights (`HGET`, `HSET`)

**Cấm tuyệt đối:**

| Cấm | Lý do |
|-----|-------|
| `scikit-learn` (bất kỳ module nào) | ML library |
| `numpy` cho matrix operations | ML pattern |
| `torch`, `tensorflow`, `keras` | Deep learning |
| Vector similarity / cosine distance | Embedding-based approach |
| External recommendation APIs (Spotify API, Last.fm) | Ngoài scope |

**Ví dụ:**
- KHÔNG được: `from sklearn.metrics.pairwise import cosine_similarity`
- ĐƯỢC: `score = base_score + genre_weight * 0.3 + artist_weight * 0.2`

---

## 4. gRPC — Chỉ 2 calls được phép

| Call | From | To | Method |
|------|----|-----|--------|
| 1 | API Gateway | Auth Service | `ValidateToken` |
| 2 | Auth Service | User Service | `GetUserProfile` |

**Mọi service-to-service call khác: REST hoặc Kafka. Không có ngoại lệ.**

Nếu Claude muốn đề xuất thêm gRPC call → **phải hỏi xác nhận trước**, không tự ý implement.

**Ví dụ:**
- KHÔNG được: Music Service gọi gRPC đến Streaming Service
- KHÔNG được: Recommendation Service gọi gRPC đến User Service
- ĐƯỢC: Recommendation Service gọi `GET /internal/users/{id}/preferences` (REST)

---

## 5. Database — Database per Service

Mỗi service **chỉ được đọc/ghi database của chính mình.**

| Nếu cần data từ service khác | Cách hợp lệ |
|-----------------------------|-------------|
| Cần realtime data | Gọi REST internal API của service đó |
| Cần eventual-consistent data | Consume Kafka event, cache vào DB riêng |
| Không bao giờ | Shared DB connection / cross-service SQL JOIN |

**Ví dụ:**
- KHÔNG được: Analytics Service query trực tiếp `music_db.songs`
- KHÔNG được: Recommendation Service connect vào PostgreSQL của User Service
- ĐƯỢC: Recommendation Service gọi `GET /internal/users/{id}/preferences` → User Service trả về

---

## 6. Kafka Topics — Chỉ 5 topics trong MVP

| Topic | Producer | Consumer(s) |
|-------|----------|-------------|
| `Song_Played` | Streaming Service | Analytics, Recommendation |
| `Song_Skipped` | Streaming Service | Analytics, Recommendation |
| `New_Release` | Music Service | Notification |
| `User_Preferences_Updated` | User Service | Recommendation |
| `Notification_Sent` | Notification Service | Analytics |

Nếu Claude muốn thêm topic mới → **phải hỏi xác nhận và giải thích lý do** trước khi implement.

**Ví dụ:**
- KHÔNG được: tự tạo topic `User_Login_Event`, `Song_Favorited`, `Party_Created`
- ĐƯỢC: đề xuất "Tôi muốn thêm topic `X` vì `Y` — bạn có confirm không?"

---

## 7. Behavior khi bị yêu cầu implement out-of-scope

Khi user yêu cầu implement thứ gì nằm ngoài scope, Claude **phải**:

**a.** Nêu rõ:
> "Tính năng **[X]** nằm ngoài scope PRD V5."

**b.** Giải thích lý do bị cắt (từ PRD V5 / CLAUDE.md).

**c.** Đề xuất alternative trong scope nếu có.

**d.** Không tự ý implement — dừng lại, chờ user xác nhận override scope một cách rõ ràng bằng văn bản.

**Ví dụ:**
```
User: "Thêm Collaborative Filtering vào Recommendation Service"

Claude: "Tính năng Collaborative Filtering nằm ngoài scope PRD V5.
Lý do: Nhóm đã quyết định dùng Rule Engine thay ML/CF để đảm bảo
timeline 1 học kỳ và tránh phụ thuộc vào training data.
Alternative: Tôi có thể tăng độ chính xác Rule Engine bằng cách
thêm context_bonus cho time_of_day và mood_tag.
Nếu bạn muốn override scope, hãy xác nhận rõ ràng."
```

---

## Checklist trước khi implement bất kỳ thứ gì

- [ ] Tính năng có trong IN Scope (CLAUDE.md)?
- [ ] Không dùng ML/AI library nào?
- [ ] Recommendation chỉ dùng Rule Engine + Redis?
- [ ] Không thêm gRPC call mới (ngoài 2 calls cho phép)?
- [ ] Service chỉ đọc/ghi DB của chính nó?
- [ ] Không thêm Kafka topic mới mà chưa hỏi?
