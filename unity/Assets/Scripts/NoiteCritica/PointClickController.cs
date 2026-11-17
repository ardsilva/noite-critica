// Entrada point-and-click: raycast -> Hotspot / KidActor / chao (NavMesh).
// Clique esquerdo: verbo selecionado (ou olhar na 1a vez, usar depois). Clique direito: olhar.
using UnityEngine;
using UnityEngine.AI;

namespace NoiteCritica
{
    public class PointClickController : MonoBehaviour
    {
        public RuleRunner runner;
        public Camera cam;
        public KidActor[] kids;
        [HideInInspector] public string selectedVerb;   // preenchido pela UI de verbos
        [HideInInspector] public string selectedItem;   // preenchido pela UI de inventario

        void Update()
        {
            var st = runner.State;
            if (st.Busy || st.InCutscene) return;
            bool left = Input.GetMouseButtonDown(0), right = Input.GetMouseButtonDown(1);
            if (!left && !right) return;
            if (!Physics.Raycast(cam.ScreenPointToRay(Input.mousePosition), out var hit, 200f)) return;

            var hs = hit.collider.GetComponentInParent<Hotspot>();
            if (hs != null)
            {
                string verb = right ? "look"
                    : selectedItem != null ? "item"
                    : selectedVerb ?? (st.Looked.Contains(st.Room + ":" + hs.hotspotId) ? "use" : "look");
                StartCoroutine(runner.Interact(hs, verb, selectedItem));
                selectedVerb = null; selectedItem = null;
                return;
            }
            if (left && NavMesh.SamplePosition(hit.point, out var nav, 1.5f, NavMesh.AllAreas))
                foreach (var k in kids) if (k.kidId == st.Active) StartCoroutine(k.WalkTo(nav.position));
        }
    }
}
