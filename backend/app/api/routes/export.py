"""Export API endpoints."""

import csv
import io
import json
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Document, Entity, EntityMention, Face, FaceCluster
from app.services.search import SearchService
from app.schemas.search import SearchQuery

router = APIRouter()


@router.get("/search")
async def export_search_results(
    q: str = Query(..., min_length=1),
    format: str = Query("json", enum=["json", "csv"]),
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Export search results."""
    query = SearchQuery(query=q, page=1, page_size=limit)
    service = SearchService(db)
    results = await service.search(query)

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=["id", "filename", "title", "page_count", "score"],
        )
        writer.writeheader()
        for hit in results.hits:
            writer.writerow({
                "id": hit.id,
                "filename": hit.filename,
                "title": hit.title or "",
                "page_count": hit.page_count,
                "score": hit.score,
            })
        content = output.getvalue()
        media_type = "text/csv"
        filename = f"search_results_{q[:20]}.csv"
    else:
        content = json.dumps({
            "query": results.query,
            "total": results.total,
            "hits": [hit.model_dump() for hit in results.hits],
        }, indent=2)
        media_type = "application/json"
        filename = f"search_results_{q[:20]}.json"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/entities")
async def export_entities(
    entity_type: str | None = Query(None),
    format: str = Query("json", enum=["json", "csv"]),
    limit: int = Query(10000, ge=1, le=100000),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Export entities."""
    query = select(Entity).order_by(Entity.mention_count.desc()).limit(limit)

    if entity_type:
        query = query.where(Entity.entity_type == entity_type.upper())

    result = await db.execute(query)
    entities = result.scalars().all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=["id", "name", "type", "mention_count", "document_count"],
        )
        writer.writeheader()
        for entity in entities:
            writer.writerow({
                "id": entity.id,
                "name": entity.name,
                "type": entity.entity_type,
                "mention_count": entity.mention_count,
                "document_count": entity.document_count,
            })
        content = output.getvalue()
        media_type = "text/csv"
        type_suffix = f"_{entity_type}" if entity_type else ""
        filename = f"entities{type_suffix}.csv"
    else:
        content = json.dumps({
            "total": len(entities),
            "entities": [
                {
                    "id": e.id,
                    "name": e.name,
                    "type": e.entity_type,
                    "mention_count": e.mention_count,
                    "document_count": e.document_count,
                }
                for e in entities
            ],
        }, indent=2)
        media_type = "application/json"
        type_suffix = f"_{entity_type}" if entity_type else ""
        filename = f"entities{type_suffix}.json"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/entity/{entity_id}/documents")
async def export_entity_documents(
    entity_id: int,
    format: str = Query("json", enum=["json", "csv"]),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Export documents mentioning an entity."""
    # Get entity
    entity_result = await db.execute(
        select(Entity).where(Entity.id == entity_id)
    )
    entity = entity_result.scalar_one_or_none()

    if not entity:
        return Response(
            content=json.dumps({"error": "Entity not found"}),
            media_type="application/json",
            status_code=404,
        )

    # Get documents
    query = (
        select(Document, EntityMention)
        .join(EntityMention, EntityMention.document_id == Document.id)
        .where(EntityMention.entity_id == entity_id)
    )
    result = await db.execute(query)

    docs_data = []
    for row in result.all():
        doc, mention = row
        docs_data.append({
            "document_id": doc.id,
            "filename": doc.filename,
            "title": doc.title,
            "page_count": doc.page_count,
            "context": mention.context_snippet,
        })

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=["document_id", "filename", "title", "page_count", "context"],
        )
        writer.writeheader()
        writer.writerows(docs_data)
        content = output.getvalue()
        media_type = "text/csv"
        filename = f"entity_{entity_id}_documents.csv"
    else:
        content = json.dumps({
            "entity": {
                "id": entity.id,
                "name": entity.name,
                "type": entity.entity_type,
            },
            "documents": docs_data,
            "total": len(docs_data),
        }, indent=2)
        media_type = "application/json"
        filename = f"entity_{entity_id}_documents.json"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/faces/clusters")
async def export_face_clusters(
    format: str = Query("json", enum=["json", "csv"]),
    min_faces: int = Query(2, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Export face clusters."""
    query = (
        select(FaceCluster)
        .where(FaceCluster.face_count >= min_faces)
        .order_by(FaceCluster.face_count.desc())
    )
    result = await db.execute(query)
    clusters = result.scalars().all()

    clusters_data = []
    for cluster in clusters:
        # Get faces in this cluster
        faces_result = await db.execute(
            select(Face, Document.filename)
            .join(Document, Document.id == Face.document_id)
            .where(Face.cluster_id == cluster.id)
        )
        faces = [
            {
                "face_id": face.id,
                "document_filename": filename,
                "page": face.page_number,
                "crop_path": face.face_crop_path,
            }
            for face, filename in faces_result.all()
        ]

        clusters_data.append({
            "cluster_id": cluster.id,
            "name": cluster.name,
            "face_count": cluster.face_count,
            "document_count": cluster.document_count,
            "faces": faces,
        })

    if format == "csv":
        # For CSV, flatten the structure
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=["cluster_id", "cluster_name", "face_id", "document_filename", "page", "crop_path"],
        )
        writer.writeheader()
        for cluster in clusters_data:
            for face in cluster["faces"]:
                writer.writerow({
                    "cluster_id": cluster["cluster_id"],
                    "cluster_name": cluster["name"] or "",
                    "face_id": face["face_id"],
                    "document_filename": face["document_filename"],
                    "page": face["page"] or "",
                    "crop_path": face["crop_path"] or "",
                })
        content = output.getvalue()
        media_type = "text/csv"
        filename = "face_clusters.csv"
    else:
        content = json.dumps({
            "total_clusters": len(clusters_data),
            "clusters": clusters_data,
        }, indent=2)
        media_type = "application/json"
        filename = "face_clusters.json"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/documents")
async def export_documents(
    format: str = Query("json", enum=["json", "csv"]),
    status: str | None = Query(None),
    limit: int = Query(10000, ge=1, le=100000),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Export document metadata."""
    query = select(Document).order_by(Document.filename).limit(limit)

    if status:
        query = query.where(Document.ocr_status == status)

    result = await db.execute(query)
    documents = result.scalars().all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=[
                "id", "filename", "title", "page_count", "file_size",
                "has_images", "image_count", "ocr_status", "entity_status",
                "face_status", "earliest_date", "latest_date",
            ],
        )
        writer.writeheader()
        for doc in documents:
            writer.writerow({
                "id": doc.id,
                "filename": doc.filename,
                "title": doc.title or "",
                "page_count": doc.page_count,
                "file_size": doc.file_size or 0,
                "has_images": doc.has_images,
                "image_count": doc.image_count,
                "ocr_status": doc.ocr_status,
                "entity_status": doc.entity_status,
                "face_status": doc.face_status,
                "earliest_date": doc.earliest_date.isoformat() if doc.earliest_date else "",
                "latest_date": doc.latest_date.isoformat() if doc.latest_date else "",
            })
        content = output.getvalue()
        media_type = "text/csv"
        filename = "documents.csv"
    else:
        content = json.dumps({
            "total": len(documents),
            "documents": [
                {
                    "id": doc.id,
                    "filename": doc.filename,
                    "title": doc.title,
                    "page_count": doc.page_count,
                    "file_size": doc.file_size,
                    "has_images": doc.has_images,
                    "image_count": doc.image_count,
                    "ocr_status": doc.ocr_status,
                    "entity_status": doc.entity_status,
                    "face_status": doc.face_status,
                    "earliest_date": doc.earliest_date.isoformat() if doc.earliest_date else None,
                    "latest_date": doc.latest_date.isoformat() if doc.latest_date else None,
                }
                for doc in documents
            ],
        }, indent=2)
        media_type = "application/json"
        filename = "documents.json"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
