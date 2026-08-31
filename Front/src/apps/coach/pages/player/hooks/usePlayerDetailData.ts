import { useEffect, useRef, useState } from "react";
import playerService from "../../../services/playerService";
import teamplayerService from "../../../services/teamplayerService";
import demarcationService, { type DemarcationOption } from "../../../services/demarcationService";

interface UsePlayerDetailDataResult {
  teamPlayer: any | null;
  setTeamPlayer: React.Dispatch<React.SetStateAction<any | null>>;
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  photo: string | null;
  setPhoto: React.Dispatch<React.SetStateAction<string | null>>;
  demarcationOptions: DemarcationOption[];
}

export function usePlayerDetailData(
  id: string | undefined,
  dominantFootMap: Record<string, number>,
  familyMemberMap: Record<string, number> = {}
): UsePlayerDetailDataResult {
  const [teamPlayer, setTeamPlayer] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [demarcationOptions, setDemarcationOptions] = useState<DemarcationOption[]>([]);
  const photoRef = useRef<string | null>(null);

  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const opts = await demarcationService.getDemarcations();
        if (mounted) setDemarcationOptions(opts);
      } catch {
        // Non-blocking: keep page usable without demarcation catalog.
      }

      if (!id) return;

      try {
        const tp = await teamplayerService.getTeamPlayerById(id);
        if (!mounted) return;

        if (tp) {
          setTeamPlayer(tp);
          setForm({
            alias: tp.player?.alias ?? "",
            name: tp.player?.name ?? "",
            lastName: tp.player?.lastName ?? "",
            dorsal: tp.dorsal ?? null,
            phone: tp.contactInfo?.phone ?? "",
            email: tp.contactInfo?.email ?? "",
            street: tp.contactInfo?.address?.street ?? "",
            city: tp.contactInfo?.address?.city ?? "",
            postalCode: tp.contactInfo?.address?.postalCode ?? "",
            province: tp.contactInfo?.address?.province ?? "",
            country: tp.contactInfo?.address?.country ?? "",
            procedencia: tp.player?.procedencia ?? "",
            height: tp.physicalInfo?.height ?? null,
            weight: tp.physicalInfo?.weight ?? null,
            dominantFoot: tp.physicalInfo?.dominantFoot ?? "",
            dominantFootId: tp.physicalInfo?.dominantFoot
              ? dominantFootMap[tp.physicalInfo?.dominantFoot] ?? null
              : null,
            enfermedades: tp.player?.enfermedades ?? "",
            alergias: tp.player?.alergias ?? "",
            activePositionName: tp.demarcation?.activePositionName ?? "",
            activePositionId: tp.demarcation?.activePositionId ?? null,
            possibleDemarcations: (tp.demarcation?.possibleDemarcations ?? []).join(", "),
            urlPhoto: tp.player?.urlPhoto ?? tp.player?.photoUrl ?? null,
          });

          const photoUrl = tp.player?.urlPhoto ?? tp.player?.photoUrl ?? null;
          if (photoUrl) {
            try {
              const obj = await playerService.fetchPlayerPhoto(photoUrl);
              if (!mounted) return;
              setPhoto(obj);
            } catch {
              // Optional asset, ignore fetch failures.
            }
          }
          return;
        }

        const p = await playerService.getPlayerById(id);
        if (!mounted || !p) return;

        setTeamPlayer({ player: p });
        setForm({
          alias: p.alias ?? "",
          name: p.name ?? "",
          lastName: p.lastName ?? "",
          dorsal: null,
          phone: "",
          email: "",
          street: "",
          city: "",
          postalCode: "",
          province: "",
          country: "",
          procedencia: "",
          height: null,
          weight: null,
          dominantFoot: "",
          dominantFootId: null,
          enfermedades: "",
          alergias: "",
          activePositionName: "",
          activePositionId: null,
          possibleDemarcations: "",
          urlPhoto: p.urlPhoto ?? null,
        });

        if (p.urlPhoto) {
          try {
            const obj = await playerService.fetchPlayerPhoto(p.urlPhoto);
            if (!mounted) return;
            setPhoto(obj);
          } catch {
            // Optional asset, ignore fetch failures.
          }
        }
      } catch {
        // Keep current state as-is on load failures.
      }
    }

    load();

    return () => {
      mounted = false;
      if (photoRef.current) {
        try {
          URL.revokeObjectURL(photoRef.current);
        } catch {
          // Ignore revoke failures.
        }
      }
    };
  }, [id, dominantFootMap, familyMemberMap]);

  return {
    teamPlayer,
    setTeamPlayer,
    form,
    setForm,
    photo,
    setPhoto,
    demarcationOptions,
  };
}
