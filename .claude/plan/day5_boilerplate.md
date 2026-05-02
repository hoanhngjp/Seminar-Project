# day5_boilerplate.md — Tạo Boilerplate Tất Cả Services

> Mục tiêu ngày 5: 9 services + 1 React SPA build thành công, GET /health → 200, Docker image build được.
> Port mapping và config: xem `.claude/plan/shared_contracts.md`

---

## Mục tiêu cuối ngày

- [ ] `dotnet build SmartMusic.sln` — 0 errors
- [ ] `uvicorn` chạy được recommendation-service
- [ ] `npm run dev` chạy được, hiển thị "Smart Music Platform"
- [ ] `docker-compose up --build` — không có container nào exit với code != 0
- [ ] `curl http://localhost:{port}/health` → 200 cho tất cả 9 services + Python

---

## 8 C# Services — Files cần tạo (Clean Architecture)

Mỗi C# service có cấu trúc:
```
services/{service-name}/
├── src/
│   ├── {Name}.Api/
│   │   ├── Controllers/HealthController.cs
│   │   ├── Middleware/CorrelationIdMiddleware.cs
│   │   ├── Program.cs
│   │   └── {Name}.Api.csproj
│   ├── {Name}.Application/
│   │   ├── Interfaces/          # (thư mục rỗng, thêm file .gitkeep)
│   │   └── {Name}.Application.csproj
│   ├── {Name}.Infrastructure/
│   │   ├── DependencyInjection.cs
│   │   └── {Name}.Infrastructure.csproj
│   └── {Name}.Domain/
│       ├── Exceptions/DomainException.cs
│       └── {Name}.Domain.csproj
├── tests/
│   ├── {Name}.UnitTests/
│   │   └── {Name}.UnitTests.csproj
│   └── {Name}.IntegrationTests/
│       └── {Name}.IntegrationTests.csproj
└── Dockerfile
```

### Danh sách 8 C# Services

| # | Service folder | Namespace prefix | Port |
|---|---------------|-----------------|------|
| 1 | `api-gateway` | `ApiGateway` | 5000 |
| 2 | `auth-service` | `Auth` | 5001 |
| 3 | `user-service` | `User` | 5002 |
| 4 | `music-service` | `Music` | 5003 |
| 5 | `streaming-service` | `Streaming` | 5004 |
| 6 | `listening-party-service` | `ListeningParty` | 5005 |
| 7 | `analytics-service` | `Analytics` | 5006 |
| 8 | `notification-service` | `Notification` | 5007 |
| 9 | `search-service` | `Search` | 5008 |

---

## Definition of Done — Mỗi C# Service

### Program.cs (tối thiểu)
```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CorrelationId
builder.Services.AddHttpContextAccessor();

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.UseSwagger().UseSwaggerUI();

app.UseRouting();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

### HealthController.cs (bắt buộc cho mọi service)
```csharp
[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        status = "healthy",
        service = "{ServiceName}",
        version = "1.0.0",
        timestamp = DateTime.UtcNow
    });
}
```

### Dockerfile (tối thiểu)
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/{Name}.Api/{Name}.Api.csproj", "src/{Name}.Api/"]
COPY ["src/{Name}.Application/{Name}.Application.csproj", "src/{Name}.Application/"]
COPY ["src/{Name}.Infrastructure/{Name}.Infrastructure.csproj", "src/{Name}.Infrastructure/"]
COPY ["src/{Name}.Domain/{Name}.Domain.csproj", "src/{Name}.Domain/"]
RUN dotnet restore "src/{Name}.Api/{Name}.Api.csproj"
COPY . .
RUN dotnet build "src/{Name}.Api/{Name}.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "src/{Name}.Api/{Name}.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "{Name}.Api.dll"]
```

---

## Python Service — recommendation-service

### Folder structure
```
services/recommendation-service/
├── src/
│   └── recommendation_service/
│       ├── __init__.py
│       ├── main.py              # FastAPI app entry
│       ├── routers/
│       │   └── health.py
│       ├── schemas/
│       │   └── health.py
│       └── middleware/
│           └── correlation_id.py
├── tests/
│   ├── unit/
│   │   └── __init__.py
│   └── integration/
│       └── __init__.py
├── requirements.txt
├── requirements-test.txt
└── Dockerfile
```

### main.py (tối thiểu)
```python
from fastapi import FastAPI
from recommendation_service.routers import health

app = FastAPI(title="Recommendation Service", version="1.0.0")
app.include_router(health.router)
```

### routers/health.py
```python
from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "recommendation-service",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
```

### Dockerfile (Python)
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
ENV PYTHONPATH=/app/src
EXPOSE 8000
CMD ["uvicorn", "recommendation_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### requirements.txt (boilerplate)
```
fastapi==0.111.*
uvicorn[standard]==0.29.*
pydantic==2.7.*
redis[asyncio]==5.0.*
httpx==0.27.*
aiokafka==0.10.*
structlog==24.1.*
```

### requirements-test.txt
```
pytest==8.2.*
httpx==0.27.*
pytest-asyncio==0.23.*
respx==0.21.*
fakeredis[aioredis]
```

---

## React TypeScript SPA — frontend

### Setup command
```bash
cd services/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install axios react-router-dom zustand
npm install -D @types/react @types/react-dom
```

### Folder structure (sau khi setup)
```
services/frontend/
├── src/
│   ├── api/
│   │   └── client.ts          # Axios instance + interceptors
│   ├── components/
│   │   └── .gitkeep
│   ├── hooks/
│   │   └── .gitkeep
│   ├── pages/
│   │   ├── HomePage.tsx       # Placeholder
│   │   └── LoginPage.tsx      # Placeholder
│   ├── store/
│   │   └── authStore.ts       # Zustand — access token in-memory
│   ├── types/
│   │   └── listening-party.ts # Copy từ shared_contracts.md Section 6
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
└── package.json
```

### src/api/client.ts (bắt buộc)
```typescript
import axios from 'axios';

// Access token in-memory — KHÔNG dùng localStorage
let _accessToken: string | null = null;
export const setAccessToken = (token: string | null) => { _accessToken = token; };
export const getAccessToken = () => _accessToken;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  withCredentials: true, // gửi HTTP-only refresh cookie
});

// Request interceptor — attach access token
apiClient.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// Response interceptor — placeholder cho refresh logic (tuần 2)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // TODO tuần 2: handle 401 TOKEN_EXPIRED → auto refresh
    return Promise.reject(error);
  }
);
```

### src/store/authStore.ts
```typescript
import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: 'Listener' | 'Creator' | 'Admin' | null;
  setAuth: (token: string, userId: string, role: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  userId: null,
  role: null,
  setAuth: (token, userId, role) => set({ accessToken: token, userId, role: role as AuthState['role'] }),
  clearAuth: () => set({ accessToken: null, userId: null, role: null }),
}));
```

### src/App.tsx (placeholder routes)
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Smart Music Platform — Home (placeholder)</div>} />
        <Route path="/login" element={<div>Login Page (placeholder)</div>} />
        <Route path="/search" element={<div>Search Page (placeholder)</div>} />
        <Route path="/party/:roomId" element={<div>Listening Party (placeholder)</div>} />
        <Route path="/dashboard" element={<div>Creator Dashboard (placeholder)</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### vite.config.ts (proxy cho local dev)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:5005', ws: true },
    },
  },
});
```

---

## Prompt dùng với Claude — Tạo Boilerplate Tất Cả C# Services

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, và security-non-negotiable/RULE.md
đính kèm trước khi làm.

Tạo boilerplate cho service: {TÊN SERVICE} (services/{service-folder}/)
Port: {PORT}

Yêu cầu boilerplate tối thiểu:
1. Clean Architecture 4 projects: {Name}.Api, {Name}.Application,
   {Name}.Infrastructure, {Name}.Domain
2. GET /health endpoint → 200 { status, service, version, timestamp }
3. CorrelationIdMiddleware: đọc X-Correlation-Id từ header,
   nếu không có thì tạo UUID mới, inject vào response header
4. Program.cs: AddControllers, AddEndpointsApiExplorer, AddSwaggerGen,
   middleware pipeline đúng thứ tự
5. Dockerfile: multi-stage build, expose port 80
6. appsettings.json: chỉ có Logging và AllowedHosts
7. appsettings.Development.json: Logging.LogLevel.Default = "Debug"
8. 2 test projects: {Name}.UnitTests và {Name}.IntegrationTests
   (csproj rỗng với đúng package references)

KHÔNG implement business logic — chỉ boilerplate.
KHÔNG hardcode secret hay connection string.
KHÔNG thêm database connection — sẽ thêm ở tuần sau.

Sau khi tạo xong, cung cấp lệnh verify:
  dotnet build src/{Name}.Api/{Name}.Api.csproj
  dotnet run --project src/{Name}.Api -- --urls http://localhost:{PORT}
  curl http://localhost:{PORT}/health
```

**Chạy prompt này 8 lần, thay {TÊN SERVICE}, {service-folder}, {Name}, {PORT}:**

| Lần | {TÊN SERVICE} | {service-folder} | {Name} | {PORT} |
|-----|--------------|-----------------|--------|--------|
| 1 | API Gateway | api-gateway | ApiGateway | 5000 |
| 2 | Auth Service | auth-service | Auth | 5001 |
| 3 | User Service | user-service | User | 5002 |
| 4 | Music Service | music-service | Music | 5003 |
| 5 | Streaming Service | streaming-service | Streaming | 5004 |
| 6 | Listening Party Service | listening-party-service | ListeningParty | 5005 |
| 7 | Analytics Service | analytics-service | Analytics | 5006 |
| 8 | Notification Service | notification-service | Notification | 5007 |
| 9 | Search Service | search-service | Search | 5008 |

---

## Prompt dùng với Claude — Tạo React SPA Boilerplate

```
Đọc CLAUDE.md, react-spa/SKILL.md, và security-non-negotiable/RULE.md
đính kèm trước khi làm.

Tạo React TypeScript SPA boilerplate cho Smart Music Platform
(services/frontend/).

Yêu cầu:
1. Vite + React + TypeScript (đã có từ npm create vite)
2. Cài packages: axios, react-router-dom, zustand
3. Tạo src/api/client.ts: Axios instance với:
   - baseURL từ VITE_API_BASE_URL env
   - withCredentials: true (gửi HTTP-only cookie)
   - Request interceptor: attach access token từ memory
   - Response interceptor: placeholder cho refresh logic
   - KHÔNG dùng localStorage hay sessionStorage cho token
4. Tạo src/store/authStore.ts: Zustand store giữ accessToken in-memory
5. Tạo src/types/listening-party.ts: copy interfaces từ
   .claude/plan/shared_contracts.md Section 6
6. Tạo src/App.tsx: React Router với 5 placeholder routes:
   /, /login, /search, /party/:roomId, /dashboard
7. Cập nhật vite.config.ts: proxy /api → localhost:5000,
   proxy /ws → ws://localhost:5005
8. src/pages/HomePage.tsx: hiển thị "Smart Music Platform" (text đơn giản)

Verify: npm run dev → http://localhost:3000 hiển thị "Smart Music Platform"
```

---

## Checklist Verify Cuối Ngày

```bash
# 1. Build tất cả C# projects
dotnet build SmartMusic.sln
# Expected: Build succeeded. 0 Error(s)

# 2. Chạy Python service
cd services/recommendation-service
pip install -r requirements.txt
uvicorn recommendation_service.main:app --port 8000 &
curl http://localhost:8000/health
# Expected: {"status":"healthy","service":"recommendation-service",...}

# 3. Chạy React dev server
cd services/frontend
npm run dev &
# Expected: Local: http://localhost:3000/
# Mở browser → hiển thị "Smart Music Platform"

# 4. Docker build test (chọn 2-3 services để verify)
docker build -t auth-service-test services/auth-service/
docker build -t recommendation-test services/recommendation-service/
docker build -t frontend-test services/frontend/

# 5. docker-compose up --build
cd infra
docker-compose up --build -d
sleep 30  # chờ services khởi động

# 6. Health check tất cả services
for port in 5000 5001 5002 5003 5004 5005 5006 5007 5008; do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health)
  echo "Port $port: HTTP $status"
done
curl -s -o /dev/null -w "Port 8000 (Python): HTTP %{http_code}\n" http://localhost:8000/health

# Expected: tất cả HTTP 200

# 7. Verify không có container exit
docker-compose ps
# Expected: tất cả containers Status = Up
```

---

## Lỗi thường gặp và cách xử lý

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| Port đã được dùng | Service khác đang chạy | `netstat -ano | findstr :{PORT}` → kill process |
| `dotnet build` lỗi project reference | .csproj thiếu ProjectReference | Thêm `<ProjectReference Include="../{Name}.Domain/{Name}.Domain.csproj" />` |
| Docker `COPY failed` | File path sai trong Dockerfile | Kiểm tra relative path từ `services/{name}/` |
| Python `ModuleNotFoundError` | PYTHONPATH không set | `export PYTHONPATH=./src` trước khi chạy uvicorn |
| React `Cannot find module` | package chưa install | `npm install` lại |
| Port 3000 conflict | Vite mặc định 5173 | Kiểm tra `vite.config.ts` có `server.port: 3000` |
