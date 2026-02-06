"""Face API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import tempfile

from app.db import get_db
from app.models import Face, FaceCluster, Document
from app.schemas.face import (
    FaceResponse,
    FaceListResponse,
    FaceClusterResponse,
    FaceClusterListResponse,
    FaceSimilarityResult,
    FaceSimilarityResponse,
)
from app.services.chromadb import get_chromadb_service
from app.core.config import settings

router = APIRouter()


@router.get("", response_model=FaceListResponse)
async def list_faces(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    document_id: int | None = Query(None),
    cluster_id: int | None = Query(None),
    unclustered: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> FaceListResponse:
    """List detected faces with pagination."""
    query = select(Face, Document.filename).join(Document, Document.id == Face.document_id)

    if document_id:
        query = query.where(Face.document_id == document_id)

    if cluster_id:
        query = query.where(Face.cluster_id == cluster_id)

    if unclustered:
        query = query.where(Face.cluster_id.is_(None))

    # Get total count
    count_base = select(Face)
    if document_id:
        count_base = count_base.where(Face.document_id == document_id)
    if cluster_id:
        count_base = count_base.where(Face.cluster_id == cluster_id)
    if unclustered:
        count_base = count_base.where(Face.cluster_id.is_(None))

    count_query = select(func.count()).select_from(count_base.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.order_by(Face.id).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    faces = []
    for row in result.all():
        face, filename = row
        face_response = FaceResponse.model_validate(face)
        face_response.document_filename = filename
        faces.append(face_response)

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return FaceListResponse(
        faces=faces,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/clusters", response_model=FaceClusterListResponse)
async def list_face_clusters(
    min_faces: int = Query(2, ge=1),
    db: AsyncSession = Depends(get_db),
) -> FaceClusterListResponse:
    """List face clusters (same person groups)."""
    query = (
        select(FaceCluster)
        .where(FaceCluster.face_count >= min_faces)
        .order_by(FaceCluster.face_count.desc())
    )

    result = await db.execute(query)
    clusters = result.scalars().all()

    cluster_responses = []
    for cluster in clusters:
        # Get representative face
        rep_face = None
        if cluster.representative_face_id:
            face_result = await db.execute(
                select(Face, Document.filename)
                .join(Document, Document.id == Face.document_id)
                .where(Face.id == cluster.representative_face_id)
            )
            row = face_result.one_or_none()
            if row:
                face, filename = row
                rep_face = FaceResponse.model_validate(face)
                rep_face.document_filename = filename

        # Get sample faces
        sample_result = await db.execute(
            select(Face, Document.filename)
            .join(Document, Document.id == Face.document_id)
            .where(Face.cluster_id == cluster.id)
            .limit(5)
        )
        sample_faces = []
        for row in sample_result.all():
            face, filename = row
            face_response = FaceResponse.model_validate(face)
            face_response.document_filename = filename
            sample_faces.append(face_response)

        cluster_responses.append(FaceClusterResponse(
            id=cluster.id,
            name=cluster.name,
            face_count=cluster.face_count,
            document_count=cluster.document_count,
            representative_face=rep_face,
            sample_faces=sample_faces,
        ))

    return FaceClusterListResponse(
        clusters=cluster_responses,
        total=len(cluster_responses),
    )


@router.get("/{face_id}", response_model=FaceResponse)
async def get_face(
    face_id: int,
    db: AsyncSession = Depends(get_db),
) -> FaceResponse:
    """Get a specific face."""
    result = await db.execute(
        select(Face, Document.filename)
        .join(Document, Document.id == Face.document_id)
        .where(Face.id == face_id)
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Face not found")

    face, filename = row
    face_response = FaceResponse.model_validate(face)
    face_response.document_filename = filename
    return face_response


@router.get("/{face_id}/similar", response_model=FaceSimilarityResponse)
async def find_similar_faces(
    face_id: int,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> FaceSimilarityResponse:
    """Find faces similar to the given face."""
    # Get the face and its embedding ID
    result = await db.execute(
        select(Face.embedding_id).where(Face.id == face_id)
    )
    row = result.one_or_none()

    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="Face or embedding not found")

    embedding_id = row[0]

    # Get embedding from ChromaDB
    chromadb = get_chromadb_service()
    embedding_data = chromadb.get_embedding(embedding_id)

    if not embedding_data or not embedding_data["embedding"]:
        raise HTTPException(status_code=404, detail="Embedding not found")

    # Search for similar faces
    search_results = chromadb.search_similar(
        query_embedding=embedding_data["embedding"],
        n_results=limit + 1,  # +1 to exclude the query face itself
    )

    # Get face details for results
    similar_faces = []
    if search_results["ids"] and search_results["ids"][0]:
        for i, emb_id in enumerate(search_results["ids"][0]):
            if emb_id == embedding_id:
                continue  # Skip the query face

            # Get face by embedding_id
            face_result = await db.execute(
                select(Face, Document.filename)
                .join(Document, Document.id == Face.document_id)
                .where(Face.embedding_id == emb_id)
            )
            face_row = face_result.one_or_none()

            if face_row:
                face, filename = face_row
                face_response = FaceResponse.model_validate(face)
                face_response.document_filename = filename

                distance = search_results["distances"][0][i] if search_results["distances"] else 0
                similarity = 1 / (1 + distance)  # Convert distance to similarity

                similar_faces.append(FaceSimilarityResult(
                    face=face_response,
                    similarity=similarity,
                    distance=distance,
                ))

    return FaceSimilarityResponse(
        query_face_id=face_id,
        results=similar_faces[:limit],
        total=len(similar_faces),
    )


@router.post("/search", response_model=FaceSimilarityResponse)
async def search_faces_by_image(
    file: UploadFile = File(...),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> FaceSimilarityResponse:
    """Search for similar faces by uploading an image."""
    import face_recognition
    import numpy as np

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Load and encode the uploaded face
        image = face_recognition.load_image_file(tmp_path)
        face_locations = face_recognition.face_locations(image)

        if not face_locations:
            raise HTTPException(status_code=400, detail="No face detected in the uploaded image")

        # Use the first detected face
        face_encodings = face_recognition.face_encodings(image, face_locations)
        if not face_encodings:
            raise HTTPException(status_code=400, detail="Could not encode face")

        query_embedding = face_encodings[0].tolist()

        # Search ChromaDB
        chromadb = get_chromadb_service()
        search_results = chromadb.search_similar(
            query_embedding=query_embedding,
            n_results=limit,
        )

        # Get face details
        similar_faces = []
        if search_results["ids"] and search_results["ids"][0]:
            for i, emb_id in enumerate(search_results["ids"][0]):
                face_result = await db.execute(
                    select(Face, Document.filename)
                    .join(Document, Document.id == Face.document_id)
                    .where(Face.embedding_id == emb_id)
                )
                face_row = face_result.one_or_none()

                if face_row:
                    face, filename = face_row
                    face_response = FaceResponse.model_validate(face)
                    face_response.document_filename = filename

                    distance = search_results["distances"][0][i] if search_results["distances"] else 0
                    similarity = 1 / (1 + distance)

                    similar_faces.append(FaceSimilarityResult(
                        face=face_response,
                        similarity=similarity,
                        distance=distance,
                    ))

        return FaceSimilarityResponse(
            query_face_id=None,
            results=similar_faces,
            total=len(similar_faces),
        )

    finally:
        import os
        os.unlink(tmp_path)


@router.get("/clusters/{cluster_id}", response_model=FaceClusterResponse)
async def get_face_cluster(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
) -> FaceClusterResponse:
    """Get a specific face cluster with all its faces."""
    result = await db.execute(
        select(FaceCluster).where(FaceCluster.id == cluster_id)
    )
    cluster = result.scalar_one_or_none()

    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")

    # Get all faces in cluster
    faces_result = await db.execute(
        select(Face, Document.filename)
        .join(Document, Document.id == Face.document_id)
        .where(Face.cluster_id == cluster_id)
        .order_by(Face.face_size.desc())
    )

    faces = []
    for row in faces_result.all():
        face, filename = row
        face_response = FaceResponse.model_validate(face)
        face_response.document_filename = filename
        faces.append(face_response)

    return FaceClusterResponse(
        id=cluster.id,
        name=cluster.name,
        face_count=cluster.face_count,
        document_count=cluster.document_count,
        representative_face=faces[0] if faces else None,
        sample_faces=faces,
    )
