import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import newsService, { type NewsDetailDto } from "../../services/newsService";
import { useCoverImageUrl } from "../../hooks/useCoverImageUrl";
import styles from "./NewsDetail.module.css";

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [coverAspectRatio, setCoverAspectRatio] = useState<string | undefined>(undefined);
  const coverImageSrc = useCoverImageUrl(news?.coverImageUrl);

  useEffect(() => {
    if (!id) return;
    newsService.getNewsById(id).then((result) => {
      if (result) {
        setNews(result);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) return <CircularProgress />;
  if (notFound) return <p>Noticia no encontrada</p>;
  if (!news) return <p>Error cargando la noticia</p>;

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={news.title}
        subtitle={news.subtitle}
        actionBar={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/coach/news")}
            variant="outlined"
            size="small"
            sx={{ marginLeft: "auto" }}
          >
            Volver a noticias
          </Button>
        }
      >
        <Box sx={{ p: 3 }} className={styles.container}>
          {coverImageSrc && (
            <img
              src={coverImageSrc}
              alt={news.title}
              className={styles.coverImage}
              style={coverAspectRatio ? { aspectRatio: coverAspectRatio } : undefined}
              onLoad={(e) => {
                const { naturalWidth, naturalHeight } = e.currentTarget;
                if (naturalWidth && naturalHeight) {
                  setCoverAspectRatio(`${naturalWidth} / ${naturalHeight}`);
                }
              }}
            />
          )}
          <p className={styles.date}>{new Date(news.newsDate).toLocaleDateString("es-ES", { dateStyle: "medium" })}</p>
          <div className={styles.body}>{news.body}</div>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
