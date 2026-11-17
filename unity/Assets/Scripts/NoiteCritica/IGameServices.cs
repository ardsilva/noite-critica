// Tudo o que o interprete de regras precisa da "apresentacao". Implementar com UI Toolkit/uGUI,
// Cinemachine e Timeline. Cada metodo corresponde a um efeito de content/chapter1.json.
using System.Collections;
using UnityEngine;

namespace NoiteCritica
{
    public interface IGameServices
    {
        IEnumerator Say(string kid, string text);                    // ["say", who, text]
        IEnumerator Voice(string name, Color color, string text);    // ["mestre", text] / ["voice", ...]
        IEnumerator Card(string text);                               // ["card", text]
        IEnumerator Title(string big, string small);                 // ["title", big, small]
        IEnumerator Read(string title, string text);                 // ["read", title, text]
        IEnumerator Fx(string name);                                 // ["fx", name]  (thunder, transform_hall...)
        IEnumerator Camera(Vector3 pos, Vector3 look, float seconds);// ["cam", pos, look, t]
        IEnumerator CameraReset(float seconds);                      // ["camreset", t]
        IEnumerator RollD20(Vector3[] path, float seconds);          // ["d20", path, t]
        IEnumerator Minigame(string kind, System.Action<string> result); // ["ui", "melody"|"clock"] -> "ok"/"fail"/null
        void Sfx(string name);
        void Objective(string text);
        void InventoryChanged();
        void PartyChanged();
        void EnterRoom(string room);
        void EndChapter();
    }
}
