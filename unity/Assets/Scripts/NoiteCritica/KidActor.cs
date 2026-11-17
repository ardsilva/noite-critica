// Crianca jogavel: NavMeshAgent para andar + animacao procedural dos membros (mesma logica de
// Actor.update() em src/main.js). O GLB traz os nos body/head/armL/armR/legL/legR com pivo na junta.
// Na producao, trocar por rig humanoide + Animator (ver docs/PRODUCAO.md, marco M2).
using System.Collections;
using UnityEngine;
using UnityEngine.AI;

namespace NoiteCritica
{
    [RequireComponent(typeof(NavMeshAgent))]
    public class KidActor : MonoBehaviour
    {
        public string kidId;
        Transform body, head, armL, armR, legL, legR;
        NavMeshAgent agent;
        string gesture; float gestureT, gestureDur, t;

        void Awake()
        {
            agent = GetComponent<NavMeshAgent>();
            agent.speed = 3.1f; agent.angularSpeed = 720; agent.acceleration = 30;
            foreach (var tr in GetComponentsInChildren<Transform>())
                switch (tr.name)
                {
                    case "body": body = tr; break; case "head": head = tr; break;
                    case "armL": armL = tr; break; case "armR": armR = tr; break;
                    case "legL": legL = tr; break; case "legR": legR = tr; break;
                }
        }

        public IEnumerator WalkTo(Vector3 p)
        {
            agent.SetDestination(p);
            yield return null;
            while (agent.pathPending || agent.remainingDistance > agent.stoppingDistance + 0.05f) yield return null;
        }

        public void Face(Vector3 p) { p.y = transform.position.y; transform.LookAt(p); }
        public void Play(string name, float dur = 0.9f) { gesture = name; gestureT = 0; gestureDur = dur; }

        void Update()
        {
            t += Time.deltaTime;
            bool moving = agent.velocity.sqrMagnitude > 0.05f;
            float sw = moving ? Mathf.Sin(t * 11) * 43f : 0, aL = -sw, aR = sw, lean = 0;
            if (gesture != null)
            {
                gestureT += Time.deltaTime;
                float u = Mathf.Clamp01(gestureT / gestureDur), bell = Mathf.Sin(u * Mathf.PI);
                if (gesture == "cast") aR = -150 * bell;
                if (gesture == "use") { aR = -80 * bell; aL = -70 * bell; lean = 9 * bell; }
                if (gesture == "push") { aL = aR = -86 * bell; lean = 20 * bell; }
                if (gesture == "play") { aL = -50 + Mathf.Sin(gestureT * 18) * 14; aR = -40 + Mathf.Cos(gestureT * 18) * 14; }
                if (gesture == "hurt" || gesture == "cheer") aL = aR = -160 * bell;
                if (u >= 1) gesture = null;
            }
            float k = Mathf.Min(1, Time.deltaTime * 14);
            Lerp(legL, sw, k); Lerp(legR, -sw, k); Lerp(armL, aL, k); Lerp(armR, aR, k); Lerp(body, lean, k);
            if (head) head.localRotation = Quaternion.Euler(Mathf.Sin(t * 1.3f) * 2, moving ? 0 : Mathf.Sin(t * 0.7f) * 7, 0);
        }

        static void Lerp(Transform tr, float xDeg, float k)
        {
            if (tr) tr.localRotation = Quaternion.Slerp(tr.localRotation, Quaternion.Euler(xDeg, 0, 0), k);
        }
    }
}
