from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, Boolean
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./voice_notes.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Recording(Base):
    __tablename__ = "recordings"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, nullable=False)
    original_name = Column(String, nullable=False)
    duration = Column(Float, nullable=True)
    file_size = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    transcribed = Column(Boolean, default=False)
    transcription = Column(Text, nullable=True)
    transcription_json = Column(Text, nullable=True)  # JSON segments with timestamps
    language = Column(String, nullable=True)
    title = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    tasks_count = Column(Integer, default=0)


Base.metadata.create_all(bind=engine)
