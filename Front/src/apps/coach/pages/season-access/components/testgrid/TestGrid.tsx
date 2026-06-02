import React from 'react';
import styles from './TestGrid.module.css';
import type { Player, Demarcation, Status } from './types';
import useTestGridData from './hooks/useTestGridData';
import FilterBar from './components/FilterBar';
import Toolbar from './components/Toolbar';
import TestGridTable from './components/TestGridTable';
import StatusModal from './components/StatusModal';
import { STATUS_BADGE_LABELS } from './helper/helpers';

interface TestGridProps {
  initialPlayers?: Player[];
  demarcations?: Demarcation[];
  onChange?: (players: Player[]) => void;
  onPlayerChange?: (player: Player) => void;
  onPlayerRemove?: (player: Player) => Promise<void> | void;
}

const TestGrid: React.FC<TestGridProps> = (props) => {
  const {
    players,
    filtered,
    sorted,
    demarcations,
    filterTeam,
    setFilterTeam,
    filterStatus,
    setFilterStatus,
    filterDemarcation,
    setFilterDemarcation,
    sortBy,
    toggleSort,
    statusCounts,
    teamsByStatus,
    openStatusPopup,
    setOpenStatusPopup,
    demarcationCounts,
    addPlayer,
    handleExport,
    exporting,
    handleExportPdf,
    exportingPdf,
    updatePlayer,
    togglePossible,
    removePlayer,
    hasFilters,
  } = useTestGridData(props);

  return (
    <div className={styles.container}>
      <FilterBar
        filterTeam={filterTeam}
        setFilterTeam={setFilterTeam}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterDemarcation={filterDemarcation}
        setFilterDemarcation={setFilterDemarcation}
        demarcations={demarcations}
        hasFilters={hasFilters}
        clearFilters={() => { setFilterTeam(''); setFilterStatus([]); setFilterDemarcation(''); }}
        filteredLength={filtered.length}
        totalLength={players.length}
      />

      <Toolbar
        statusCounts={statusCounts}
        teamsByStatus={teamsByStatus}
        setOpenStatusPopup={setOpenStatusPopup}
        addPlayer={addPlayer}
        handleExport={handleExport}
        exporting={exporting}
        handleExportPdf={handleExportPdf}
        exportingPdf={exportingPdf}
        playersLength={sorted.length}
      />

      <TestGridTable
        sorted={sorted}
        demarcations={demarcations}
        updatePlayer={updatePlayer}
        togglePossible={togglePossible}
        removePlayer={removePlayer}
        sortBy={sortBy}
        toggleSort={toggleSort}
      />

      {openStatusPopup && (
        <StatusModal
          openStatusPopup={openStatusPopup}
          setOpenStatusPopup={setOpenStatusPopup}
          demarcationCounts={demarcationCounts}
          statusBadgeLabels={STATUS_BADGE_LABELS}
        />
      )}
    </div>
  );
};

export default TestGrid;
