// Liga uma sala importada do Blender (exterior.glb / hall.glb) ao jogo, pelo CONTRATO DE NOMES:
//   hs_<id> hotspot | st_<id> objeto de estado | win_* vidracas | glow_* emissivos | house_*/dung_* conjuntos
// Colocar no GameObject raiz do GLB instanciado na cena.
using System.Collections.Generic;
using UnityEngine;

namespace NoiteCritica
{
    public class RoomBinder : MonoBehaviour
    {
        public string roomId;                       // "exterior" | "hall"
        public string[] hiddenAtStart;              // copiar de rooms.<id>.hide no JSON
        readonly Dictionary<string, Transform> nodes = new Dictionary<string, Transform>();

        void Awake()
        {
            foreach (var t in GetComponentsInChildren<Transform>(true))
            {
                if (!nodes.ContainsKey(t.name)) nodes[t.name] = t;
                if (t.name.StartsWith("hs_"))
                {
                    var h = t.gameObject.AddComponent<Hotspot>();
                    h.hotspotId = t.name.Substring(3);
                    foreach (var mf in t.GetComponentsInChildren<MeshFilter>(true))   // colisores para o raycast
                        if (mf.GetComponent<Collider>() == null) mf.gameObject.AddComponent<MeshCollider>();
                }
            }
            foreach (var n in hiddenAtStart) SetVisible(n, false);
        }

        public Transform Node(string name) => nodes.TryGetValue(name, out var t) ? t : null;
        public void SetVisible(string name, bool on) { var t = Node(name); if (t) t.gameObject.SetActive(on); }
    }
}
