from fastapi import FastAPI
from recommendation_service.api.routes import health
from recommendation_service.middleware.correlation_id import CorrelationIdMiddleware

app = FastAPI(title="Recommendation Service", version="1.0.0")

app.add_middleware(CorrelationIdMiddleware)
app.include_router(health.router)
