// Interprete de efeitos: porta 1:1 de run() em src/main.js. Efeitos sao tuplas JSON [op, ...args].
using System.Collections;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace NoiteCritica
{
    public class RuleRunner : MonoBehaviour
    {
        public TextAsset chapterJson;             // arrastar content/chapter1.json (copiado para Assets/)
        public MonoBehaviour servicesBehaviour;   // algo que implemente IGameServices
        public RoomBinder[] rooms;
        public KidActor[] kids;

        public JObject Content { get; private set; }
        public GameState State { get; private set; } = new GameState();
        IGameServices S => (IGameServices)servicesBehaviour;
        readonly Dictionary<string, KidActor> kidById = new Dictionary<string, KidActor>();
        readonly Dictionary<string, RoomBinder> roomById = new Dictionary<string, RoomBinder>();

        void Awake()
        {
            Content = JObject.Parse(chapterJson.text);
            State.Init(Content);
            foreach (var k in kids) kidById[k.kidId] = k;
            foreach (var r in rooms) roomById[r.roomId] = r;
        }

        IEnumerator Start()
        {
            State.Busy = true;
            yield return Cutscene((string)Content["start"]["cutscene"]);
            State.Busy = false;
        }

        public RoomBinder CurrentRoom => roomById[State.Room];
        string Who(JToken t) { var s = (string)t; return s == "$a" ? State.Active : s; }
        static Vector3 V3(JToken a) => new Vector3((float)a[0], (float)a[1], -(float)a[2]); // glTF -Z -> Unity +Z
        static string Fill(string text, JObject vars)
        {
            if (vars == null) return text;
            foreach (var p in vars.Properties()) text = text.Replace("{" + p.Name + "}", p.Value.ToString());
            return text;
        }

        public IEnumerator Cutscene(string id)
        {
            bool outer = State.InCutscene;
            State.InCutscene = true;
            yield return Run((JArray)Content["cutscenes"][id], null);
            if (!outer) { State.InCutscene = false; State.Skipping = false; }
        }

        public IEnumerator Run(JArray effects, JObject vars)
        {
            foreach (JArray e in effects)
            {
                switch ((string)e[0])
                {
                    case "say": yield return S.Say(Who(e[1]), Fill((string)e[2], vars)); break;
                    case "mestre": yield return S.Voice("O Mestre", new Color(0.79f, 0.64f, 1f), Fill((string)e[1], vars)); break;
                    case "voice": { ColorUtility.TryParseHtmlString((string)e[2], out var c); yield return S.Voice((string)e[1], c, (string)e[3]); break; }
                    case "card": yield return S.Card((string)e[1]); break;
                    case "title": yield return S.Title((string)e[1], (string)e[2]); break;
                    case "read": yield return S.Read((string)e[1], (string)e[2]); break;
                    case "set": State.Flags.Add(((string)e[1]).Replace("$a", State.Active)); break;
                    case "unset": State.Flags.Remove((string)e[1]); break;
                    case "give": if (!State.Inventory.Contains((string)e[1])) { State.Inventory.Add((string)e[1]); S.InventoryChanged(); } break;
                    case "take": State.Inventory.Remove((string)e[1]); S.InventoryChanged(); break;
                    case "hp": State.ChangeHp(Who(e[1]), (int)e[2]); S.PartyChanged(); break;
                    case "show": for (int i = 1; i < e.Count; i++) CurrentRoom.SetVisible((string)e[i], true); break;
                    case "hide": for (int i = 1; i < e.Count; i++) CurrentRoom.SetVisible((string)e[i], false); break;
                    case "sfx": S.Sfx((string)e[1]); break;
                    case "fx": yield return S.Fx((string)e[1]); break;
                    case "anim": kidById[Who(e[1])].Play((string)e[2]); yield return new WaitForSeconds(0.55f); break;
                    case "wait": if (!State.Skipping) yield return new WaitForSeconds((float)e[1]); break;
                    case "cam": yield return S.Camera(V3(e[1]), V3(e[2]), (float)e[3]); break;
                    case "camreset": yield return S.CameraReset((float)e[1]); break;
                    case "obj": S.Objective((string)e[1]); break;
                    case "room": State.Room = (string)e[1]; S.EnterRoom(State.Room); break;
                    case "walk": yield return kidById[Who(e[1])].WalkTo(new Vector3((float)e[2], 0, -(float)e[3])); break;
                    case "d20":
                        {
                            var pts = new List<Vector3>();
                            foreach (var p in e[1]) pts.Add(V3(p));
                            yield return S.RollD20(pts.ToArray(), (float)e[2]);
                            break;
                        }
                    case "if": yield return Run((JArray)(State.Test(e[1]) ? e[2] : (e.Count > 3 ? e[3] : new JArray())), vars); break;
                    case "call": yield return Run((JArray)Content["macros"][(string)e[1]], vars); break;
                    case "cutscene": yield return Cutscene((string)e[1]); break;
                    case "ui":
                        {
                            string kind = (string)e[1], result = null;
                            yield return S.Minigame(kind, r => result = r);
                            if (result != null) yield return Run((JArray)Content["ui"][kind][result], vars);
                            break;
                        }
                    case "end": S.EndChapter(); break;
                    default: Debug.LogWarning("Efeito desconhecido: " + e[0]); break;
                }
            }
        }

        /// Chamado pelo PointClickController: verbo = look | take | use | talk | ability | item.
        public IEnumerator Interact(Hotspot hs, string verb, string item)
        {
            if (State.Busy) yield break;
            State.Busy = true;
            var def = (JObject)Content["rooms"][State.Room]["hotspots"][hs.hotspotId];
            var actor = kidById[State.Active];
            if (verb != "look" && def["at"] != null)
                yield return actor.WalkTo(new Vector3((float)def["at"][0], 0, -(float)def["at"][1]));
            actor.Face(hs.transform.position);
            State.Looked.Add(State.Room + ":" + hs.hotspotId);
            JToken rules = def["rules"] ?? Content["rooms"][State.Room]["protos"][(string)def["proto"]];
            JObject vars = null;
            if (def["kid"] != null)
                foreach (JObject k in (JArray)Content["party"]) if ((string)k["id"] == (string)def["kid"]) vars = k;
            var rule = State.FindRule(rules, verb, item);
            if (rule != null) yield return Run((JArray)rule["do"], vars);
            else
            {
                var d = Content["strings"]["defaults"];
                string line = verb == "ability" ? (string)d["ability"][State.Active] : (string)d[verb][Random.Range(0, ((JArray)d[verb]).Count)];
                yield return S.Say(State.Active, line);
            }
            State.Busy = false;
        }
    }
}
