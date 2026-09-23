import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
  Chip,
  Stack,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { searchAuditLog, AuditLogSearchParams, AuditEventType, UserActivityLogResponse } from '../../../services/auditLogService';
import styles from './AuditLogView.module.css';

const EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  PageAccess: 'Acceso a página',
  ConvocationAccepted: 'Convocatoria aceptada',
  ConvocationRejected: 'Convocatoria rechazada',
  PlayerEdited: 'Ficha de jugador editada',
};

export interface AuditLogViewProps {
  fixedFilters?: Partial<AuditLogSearchParams>;
}

export function AuditLogView({ fixedFilters = {} }: AuditLogViewProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UserActivityLogResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter form state
  const [filters, setFilters] = useState({
    eventType: '' as AuditEventType | '',
    search: '',
    clubId: '',
    teamId: '',
    from: '',
    to: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params: AuditLogSearchParams = {
          ...fixedFilters,
          pageNumber,
          pageSize,
        };

        if (filters.eventType) {
          params.eventType = filters.eventType;
        }
        if (filters.search) {
          params.search = filters.search;
        }
        if (filters.clubId) {
          params.clubId = filters.clubId;
        }
        if (filters.teamId) {
          params.teamId = filters.teamId;
        }
        if (filters.from) {
          params.from = filters.from;
        }
        if (filters.to) {
          params.to = filters.to;
        }

        const result = await searchAuditLog(params);
        setItems(result.items);
        setTotalCount(result.totalCount);
      } catch (err) {
        setError('Error al cargar el registro de auditoría');
        setItems([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pageNumber, pageSize, filters.eventType, filters.search, filters.clubId, filters.teamId, filters.from, filters.to]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPageNumber(1); // Reset to first page when filters change
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setPageNumber(page);
  };

  const filtersSection = (
    <Box className={styles.filtersSection}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FormControl fullWidth sx={{ minWidth: 200 }}>
          <InputLabel>Tipo de evento</InputLabel>
          <Select
            value={filters.eventType}
            label="Tipo de evento"
            onChange={e => handleFilterChange('eventType', e.target.value)}
          >
            <MenuItem value="">- Todos -</MenuItem>
            {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Buscar (usuario, alias, nombre o apellidos del jugador)"
          value={filters.search}
          onChange={e => handleFilterChange('search', e.target.value)}
          fullWidth
        />

        <TextField
          label="Desde"
          type="datetime-local"
          value={filters.from}
          onChange={e => handleFilterChange('from', e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />

        <TextField
          label="Hasta"
          type="datetime-local"
          value={filters.to}
          onChange={e => handleFilterChange('to', e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Stack>
    </Box>
  );

  if (loading) {
    return (
      <Box className={styles.container}>
        {filtersSection}
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={styles.container}>
        {filtersSection}
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box className={styles.container}>
        {filtersSection}
        <Typography>No hay eventos para mostrar</Typography>
      </Box>
    );
  }

  return (
    <Box className={styles.container}>
      {filtersSection}

      {/* Cards List */}
      <Box className={styles.cardsList}>
        {items.map(item => (
          <Card key={item.id} className={styles.eventCard}>
            <CardContent>
              <Stack direction="column" spacing={1}>
                <Box>
                  <Typography variant="subtitle2" className={styles.timestamp}>
                    {new Date(item.timestamp).toLocaleString('es-ES')}
                  </Typography>
                  <Typography variant="body2" className={styles.user}>
                    Usuario: {item.userName}
                  </Typography>
                  <Typography variant="body2">
                    Roles: {item.roles.join(', ')}
                  </Typography>
                  {item.linkedPlayerFullName && (
                    <Typography variant="body2">
                      Jugador: {item.linkedPlayerFullName}
                      {item.linkedPlayerAlias && ` (${item.linkedPlayerAlias})`}
                    </Typography>
                  )}
                  {item.teamName && (
                    <Typography variant="body2">
                      Equipo: {item.teamName}
                    </Typography>
                  )}
                  {item.clubName && (
                    <Typography variant="body2">
                      Club: {item.clubName}
                    </Typography>
                  )}
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={EVENT_TYPE_LABELS[item.eventType]}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={item.result === 'Success' ? 'Éxito' : 'Error'}
                    size="small"
                    color={item.result === 'Success' ? 'success' : 'error'}
                    variant="filled"
                  />
                </Stack>
              </Stack>

              <Typography variant="body2" className={styles.actionOrPage}>
                Acción/Página: {item.actionOrPage}
              </Typography>

              {item.reason && (
                <Typography variant="caption" color="textSecondary">
                  Motivo: {item.reason}
                </Typography>
              )}

              {item.ipAddress && (
                <Typography variant="caption" color="textSecondary">
                  IP: {item.ipAddress}
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Pagination */}
      <Box className={styles.paginationContainer}>
        <Pagination
          count={Math.ceil(totalCount / pageSize)}
          page={pageNumber}
          onChange={handlePageChange}
        />
        <Typography variant="caption" color="textSecondary">
          Total: {totalCount} eventos
        </Typography>
      </Box>
    </Box>
  );
}
