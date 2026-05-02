# Use Case Diagram — Mermaid Code
## Smart Music Streaming Platform | PRD V5 / Backlog V7

Paste vào https://mermaid.live để preview và export PNG/SVG.

---

```mermaid
flowchart LR
  Listener(["👤 Listener"])
  Creator(["🎵 Creator"])
  Admin(["🛡 Admin"])
  System(["⚙ System\n(Automated)"])

  subgraph AUTH["Authentication & Account"]
    UC1["UC-01\nĐăng nhập / Đăng xuất"]
    UC2["UC-02\nLàm mới Access Token"]
    UC3["UC-03\nOnboarding — Chọn genres/artists"]
  end

  subgraph STREAM["Music Streaming"]
    UC4["UC-04\nTìm kiếm bài hát / nghệ sĩ"]
    UC5["UC-05\nPhát nhạc"]
    UC6["UC-06\nSeek (tua) bài hát"]
    UC7["UC-07\nXem thông tin bài hát"]
  end

  subgraph REC["Recommendation"]
    UC8["UC-08\nXem gợi ý nhạc theo ngữ cảnh"]
    UC9["UC-09\nCung cấp phản hồi Play / Skip"]
  end

  subgraph PARTY["Listening Party"]
    UC10["UC-10\nTạo phòng nghe nhạc"]
    UC11["UC-11\nTham gia phòng qua Join Code"]
    UC12["UC-12\nĐiều khiển phát nhạc (Host)"]
    UC13["UC-13\nĐồng bộ nhạc realtime (Member)"]
  end

  subgraph CREATOR_UC["Creator Features"]
    UC14["UC-14\nTải nhạc lên hệ thống"]
    UC15["UC-15\nXem heatmap skip-rate"]
    UC16["UC-16\nXem thống kê lượt nghe"]
  end

  subgraph NOTIF["Notification"]
    UC17["UC-17\nNhận thông báo bài mới"]
    UC18["UC-18\nĐánh dấu đã đọc thông báo"]
  end

  subgraph ADMIN_UC["Admin Features"]
    UC19["UC-19\nQuản lý người dùng"]
    UC20["UC-20\nKiểm duyệt nội dung"]
    UC21["UC-21\nGiám sát hệ thống"]
  end

  subgraph SYS_UC["System Automated"]
    UC22["UC-22\nTracking sự kiện phát nhạc"]
    UC23["UC-23\nCập nhật trọng số gợi ý"]
    UC24["UC-24\nFan-out thông báo tới followers"]
  end

  Listener --> UC1 & UC2 & UC3
  Listener --> UC4 & UC5 & UC6 & UC7
  Listener --> UC8 & UC9
  Listener --> UC10 & UC11 & UC12 & UC13
  Listener --> UC17 & UC18

  Creator --> UC1 & UC2
  Creator --> UC14 & UC15 & UC16

  Admin --> UC1 & UC2
  Admin --> UC19 & UC20 & UC21
  Admin --> UC15 & UC16

  System --> UC22 & UC23 & UC24

  UC5 -.->|"<<include>>"| UC22
  UC9 -.->|"<<include>>"| UC23
  UC14 -.->|"<<include>>"| UC24

  style AUTH fill:#E6F1FB,stroke:#185FA5,stroke-width:1px,color:#0C447C
  style STREAM fill:#E1F5EE,stroke:#0F6E56,stroke-width:1px,color:#04342C
  style REC fill:#EEEDFE,stroke:#534AB7,stroke-width:1px,color:#26215C
  style PARTY fill:#FAEEDA,stroke:#854F0B,stroke-width:1px,color:#412402
  style CREATOR_UC fill:#E1F5EE,stroke:#0F6E56,stroke-width:1px,color:#04342C
  style NOTIF fill:#E6F1FB,stroke:#185FA5,stroke-width:1px,color:#0C447C
  style ADMIN_UC fill:#FCEBEB,stroke:#A32D2D,stroke-width:1px,color:#501313
  style SYS_UC fill:#F1EFE8,stroke:#5F5E5A,stroke-width:1px,color:#2C2C2A
```

---

## Danh sách 24 Use Cases

| ID | Tên | Actor chính | Epic |
|---|---|---|---|
| UC-01 | Đăng nhập / Đăng xuất | Listener, Creator, Admin | EPIC 1 |
| UC-02 | Làm mới Access Token | Listener, Creator, Admin | EPIC 1 |
| UC-03 | Onboarding — Chọn genres/artists | Listener | EPIC 1 |
| UC-04 | Tìm kiếm bài hát / nghệ sĩ | Listener | EPIC 5 |
| UC-05 | Phát nhạc | Listener | EPIC 3 |
| UC-06 | Seek (tua) bài hát | Listener | EPIC 3 |
| UC-07 | Xem thông tin bài hát | Listener, Creator | EPIC 3 |
| UC-08 | Xem gợi ý nhạc theo ngữ cảnh | Listener | EPIC 2 |
| UC-09 | Cung cấp phản hồi Play / Skip | Listener, System | EPIC 2 |
| UC-10 | Tạo phòng nghe nhạc | Listener (Host) | EPIC 7 |
| UC-11 | Tham gia phòng qua Join Code | Listener (Member) | EPIC 7 |
| UC-12 | Điều khiển phát nhạc (Host) | Listener (Host) | EPIC 7 |
| UC-13 | Đồng bộ nhạc realtime (Member) | Listener (Member) | EPIC 7 |
| UC-14 | Tải nhạc lên hệ thống | Creator | EPIC 1 |
| UC-15 | Xem heatmap skip-rate | Creator, Admin | EPIC 4 |
| UC-16 | Xem thống kê lượt nghe | Creator, Admin | EPIC 4 |
| UC-17 | Nhận thông báo bài mới | Listener | EPIC 6 |
| UC-18 | Đánh dấu đã đọc thông báo | Listener | EPIC 6 |
| UC-19 | Quản lý người dùng | Admin | EPIC 0 |
| UC-20 | Kiểm duyệt nội dung | Admin | PRD V5 |
| UC-21 | Giám sát hệ thống | Admin | PRD V5 |
| UC-22 | Tracking sự kiện phát nhạc | System | EPIC 4 |
| UC-23 | Cập nhật trọng số gợi ý | System | EPIC 2 |
| UC-24 | Fan-out thông báo tới followers | System | EPIC 6 |

## Ghi chú

- **<<include>>**: UC-05 include UC-22 (mỗi lần phát nhạc → tự động tracking)
- **<<include>>**: UC-09 include UC-23 (mỗi play/skip → tự động cập nhật weight)
- **<<include>>**: UC-14 include UC-24 (mỗi upload → tự động fan-out notification)
- Dùng Mermaid Live: https://mermaid.live
