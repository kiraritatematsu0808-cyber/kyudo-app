"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const GRADES = ["中1", "中2", "中3", "高1", "高2", "高3", "OB/OG", "先生"];
const PRACTICE_TYPES = ["自練", "射込み", "立"];
const SECRET_PASSWORD = "1234";

const getPositionName = (index: number, total: number) => {
  if (total === 1) return "大前";
  if (index === 0) return "大前";
  if (index === total - 1) return "落";
  if (total === 3 && index === 1) return "中";
  if (index === total - 2) return "落前";
  return ["二的", "三的", "四的", "五的"][index - 1] || `${index + 1}番`;
};

export default function Home() {
  // 🔐 認証ステート
  const [user, setUser] = useState<any>(null);
  const [linkedArcher, setLinkedArcher] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [linkArcherId, setLinkArcherId] = useState("");

  const [activeTab, setActiveTab] = useState<"individual" | "team" | "analysis" | "members" | "schedule" | "rankings">("individual");
  const [archers, setArchers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 👤 個人タブ
  const [indPracticeType, setIndPracticeType] = useState(PRACTICE_TYPES[0]);
  const [indRecords, setIndRecords] = useState([{ id: 1, arrows: ["未", "未", "未", "未"] }]);

  // 👥 団体タブ
  const [frontSize, setFrontSize] = useState(3);
  const [backSize, setBackSize] = useState(3);
  const totalSize = frontSize + backSize;
  const [teamMembers, setTeamMembers] = useState<{ grade: string; name: string }[]>(Array.from({ length: 6 }, () => ({ grade: GRADES[3], name: "" })));
  const [teamRounds, setTeamRounds] = useState([{ id: 1, arrows: Array.from({ length: 6 }, () => ["未", "未", "未", "未"]) }]);

  // 📊 分析タブ
  const [anaTimeframe, setAnaTimeframe] = useState<"all" | "year" | "month" | "week" | "custom_month">("all");
  const [anaCustomMonth, setAnaCustomMonth] = useState(new Date().toISOString().slice(0, 7));
  const [anaType, setAnaType] = useState<"all" | "tachi">("all");
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState<{ hits: number; total: number; sessionsCount: number }>({ hits: 0, total: 0, sessionsCount: 0 });
  const [arrowStats, setArrowStats] = useState<{ hits: number; total: number }[]>([{ hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }]);
  const [chartData, setChartData] = useState<{ date: string; "的中率(%)": number }[]>([]);
  const [tachiStats, setTachiStats] = useState({ kaichu: 0, sanchu: 0, nichu: 0, itchu: 0, zannen: 0 });

  // 🏆 ランキング用
  const [rankings, setRankings] = useState<{ hitRate: any[], totalArrows: any[], totalHits: any[], tachiRate: any[] }>({ hitRate: [], totalArrows: [], totalHits: [], tachiRate: [] });
  const [monthlyRankings, setMonthlyRankings] = useState<{ hitRate: any[], totalArrows: any[], totalHits: any[], tachiRate: any[] }>({ hitRate: [], totalArrows: [], totalHits: [], tachiRate: [] });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passInput, setPassInput] = useState("");
  
  // 📖 名簿用
  const [isMembersUnlocked, setIsMembersUnlocked] = useState(false);
  const [membersPassInput, setMembersPassInput] = useState("");
  const [newArcherName, setNewArcherName] = useState("");
  const [newArcherGrade, setNewArcherGrade] = useState(GRADES[3]);

  // ========== 🔄 ログイン状態の監視と初期データ取得 ==========
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      if (session?.user) await checkLinkedArcher(session.user.id);
      else setAuthLoading(false);
    };
    checkSession();
    fetchArchers();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      if (session?.user) await checkLinkedArcher(session.user.id);
      else { setLinkedArcher(null); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkLinkedArcher = async (userId: string) => {
    const { data } = await supabase.from("archers").select("*").eq("user_id", userId).single();
    if (data) setLinkedArcher(data);
    setAuthLoading(false);
  };

  const fetchArchers = async () => {
    const { data } = await supabase.from("archers").select("*").order("name", { ascending: true });
    if (data) setArchers(data);
  };

  // タブ切り替え時のデータ取得
  useEffect(() => { 
    if (activeTab === "analysis" && linkedArcher) fetchAnalysisData();
    if (activeTab === "rankings") fetchRankingData(); 
  }, [activeTab, linkedArcher, anaTimeframe, anaCustomMonth, anaType]);

  // ========== 🔐 ログイン・登録・紐付け処理 ==========
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        alert("登録完了！このままログインします。");
      }
    } catch (err: any) { alert("エラー: " + err.message); } 
    finally { setAuthLoading(false); }
  };

  const handleLinkArcher = async () => {
    if (!linkArcherId) return;
    setAuthLoading(true);
    try {
      const { error } = await supabase.from("archers").update({ user_id: user.id }).eq("id", linkArcherId);
      if (error) throw error;
      await checkLinkedArcher(user.id);
      await fetchArchers();
      alert("アカウントと名簿の紐付けが完了しました！🎉");
    } catch (err: any) { alert("エラー: " + err.message); } 
    finally { setAuthLoading(false); }
  };

  const handleLogout = async () => {
    if(confirm("ログアウトしますか？")) await supabase.auth.signOut();
  };

  // ========== 🏹 記録保存処理 ==========
  const toggleIndArrow = (rIndex: number, aIndex: number) => {
    const newRecords = [...indRecords];
    const s = newRecords[rIndex].arrows[aIndex];
    newRecords[rIndex].arrows[aIndex] = s === "未" ? "○" : s === "○" ? "×" : "未";
    setIndRecords(newRecords);
  };

  const toggleTeamArrow = (rIndex: number, mIndex: number, aIndex: number) => {
    const newRounds = [...teamRounds];
    const current = newRounds[rIndex].arrows[mIndex][aIndex];
    newRounds[rIndex].arrows[mIndex] = [...newRounds[rIndex].arrows[mIndex]];
    newRounds[rIndex].arrows[mIndex][aIndex] = current === "未" ? "○" : current === "○" ? "×" : "未";
    setTeamRounds(newRounds);
  };

  const updateTeamSizes = (newFront: number, newBack: number) => {
    setFrontSize(newFront); setBackSize(newBack);
    const newTotal = newFront + newBack;
    setTeamMembers(prev => {
      const newM = [...prev];
      while (newM.length < newTotal) newM.push({ grade: GRADES[3], name: "" });
      if (newM.length > newTotal) newM.length = newTotal;
      return newM;
    });
    setTeamRounds(prev => prev.map(r => {
      const newArr = [...r.arrows];
      while (newArr.length < newTotal) newArr.push(["未", "未", "未", "未"]);
      if (newArr.length > newTotal) newArr.length = newTotal;
      return { ...r, arrows: newArr };
    }));
  };

  const saveIndividual = async () => {
    if (!linkedArcher) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("practice_sessions").insert([{ archer_name: linkedArcher.name, records: indRecords, practice_type: indPracticeType }]);
      if (error) throw error;
      alert(`🎉 ${linkedArcher.name}さんの記録を保存しました！`);
      setIndRecords([{ id: 1, arrows: ["未", "未", "未", "未"] }]);
    } catch (err: any) { alert("保存エラー: " + err.message); } finally { setIsSaving(false); }
  };

  const saveTeam = async () => {
    if (totalSize === 0) return;
    if (teamMembers.some(m => !m.name)) { alert("全員の名前を選択してください！"); return; }
    setIsSaving(true);
    try {
      const inserts = teamMembers.map((m, mIndex) => {
        const personRecords = teamRounds.map(r => ({ id: r.id, arrows: r.arrows[mIndex] }));
        return { archer_name: m.name, records: personRecords, practice_type: "立" };
      });
      const { error } = await supabase.from("practice_sessions").insert(inserts);
      if (error) throw error;
      alert(`🎉 団体の記録を保存しました！`);
      setTeamRounds([{ id: 1, arrows: Array.from({ length: totalSize }, () => ["未", "未", "未", "未"]) }]);
    } catch (err: any) { alert("保存エラー: " + err.message); } finally { setIsSaving(false); }
  };

  const handleAddArcher = async () => {
    if (!newArcherName.trim()) return;
    const { error } = await supabase.from("archers").insert([{ name: newArcherName, grade: newArcherGrade }]);
    if (!error) { await fetchArchers(); alert(`${newArcherName}さんを登録しました！🎉`); setNewArcherName(""); }
  };

  // ========== 📊 データ取得処理 (Analysis) ==========
  const fetchAnalysisData = async () => {
    if (!linkedArcher) return;
    setIsLoadingAnalysis(true);
    try {
      const { data, error } = await supabase.from("practice_sessions").select("*").eq("archer_name", linkedArcher.name);
      if (error) throw error;
      let hits = 0; let total = 0;
      let newArrowStats = [{ hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }];
      let chartGroups: { [key: string]: { display: string; hits: number; total: number } } = {};
      let kaichu = 0, sanchu = 0, nichu = 0, itchu = 0, zannen = 0;
      const now = new Date();

      const filteredData = (data || []).filter(session => {
        const d = new Date(session.created_at);
        if (anaType === "tachi" && session.practice_type !== "立") return false;
        if (anaTimeframe === "year") return d.getFullYear() === now.getFullYear();
        if (anaTimeframe === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        if (anaTimeframe === "week") return d >= new Date(now.setDate(now.getDate() - 7));
        if (anaTimeframe === "custom_month") {
          const [year, month] = anaCustomMonth.split("-");
          return d.getFullYear() === parseInt(year) && d.getMonth() === parseInt(month) - 1;
        }
        return true;
      });

      filteredData.forEach(session => {
        const d = new Date(session.created_at);
        const sortKey = anaTimeframe === "all" ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const displayKey = anaTimeframe === "all" ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}` : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
        if (!chartGroups[sortKey]) chartGroups[sortKey] = { display: displayKey, hits: 0, total: 0 };

        session.records.forEach((record: any) => {
          let roundHits = 0; let isValidRound = 0;
          record.arrows.forEach((arrow: string, i: number) => {
            if (arrow === "○" || arrow === "×") isValidRound++;
            if (arrow === "○") { 
              hits++; total++; roundHits++; 
              if (i < 4) { newArrowStats[i].hits++; newArrowStats[i].total++; } 
              chartGroups[sortKey].hits++; chartGroups[sortKey].total++; 
            } 
            else if (arrow === "×") { 
              total++; 
              if (i < 4) { newArrowStats[i].total++; } 
              chartGroups[sortKey].total++; 
            }
          });
          if (isValidRound === 4) {
            if (roundHits === 4) kaichu++; else if (roundHits === 3) sanchu++; else if (roundHits === 2) nichu++; else if (roundHits === 1) itchu++; else if (roundHits === 0) zannen++;
          }
        });
      });
      const newChartData = Object.keys(chartGroups).sort().map(key => ({ date: chartGroups[key].display, "的中率(%)": chartGroups[key].total > 0 ? Math.round((chartGroups[key].hits / chartGroups[key].total) * 100) : 0 }));
      setAnalysisData({ hits, total, sessionsCount: filteredData.length }); setArrowStats(newArrowStats); setChartData(newChartData); setTachiStats({ kaichu, sanchu, nichu, itchu, zannen });
    } catch (error) { console.error(error); } finally { setIsLoadingAnalysis(false); }
  };

  // ========== 🏆 データ取得処理 (Ranking) ==========
  const fetchRankingData = async () => {
    try {
      const { data, error } = await supabase.from("practice_sessions").select("*");
      if (error) throw error;
      if (!data) return;

      const stats: { [name: string]: { name: string, hits: number, total: number, tachiHits: number, tachiTotal: number } } = {};
      const monthlyStats: { [name: string]: { name: string, hits: number, total: number, tachiHits: number, tachiTotal: number } } = {};
      const now = new Date();

      data.forEach(s => {
        const d = new Date(s.created_at);
        const isThisMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

        if (!stats[s.archer_name]) stats[s.archer_name] = { name: s.archer_name, hits: 0, total: 0, tachiHits: 0, tachiTotal: 0 };
        if (!monthlyStats[s.archer_name]) monthlyStats[s.archer_name] = { name: s.archer_name, hits: 0, total: 0, tachiHits: 0, tachiTotal: 0 };

        s.records.forEach((r: any) => {
          r.arrows.forEach((a: string) => {
            if (a === "○" || a === "×") {
              stats[s.archer_name].total++;
              if (s.practice_type === "立") stats[s.archer_name].tachiTotal++;
              if (isThisMonth) {
                monthlyStats[s.archer_name].total++;
                if (s.practice_type === "立") monthlyStats[s.archer_name].tachiTotal++;
              }
              if (a === "○") {
                stats[s.archer_name].hits++;
                if (s.practice_type === "立") stats[s.archer_name].tachiHits++;
                if (isThisMonth) {
                  monthlyStats[s.archer_name].hits++;
                  if (s.practice_type === "立") monthlyStats[s.archer_name].tachiHits++;
                }
              }
            }
          });
        });
      });

      // 💡 復活！！「平均矢数の半分以上」の厳格な足切りルール
      const members = Object.values(stats).filter(m => m.total > 0);
      if (members.length > 0) {
        const avgArrows = members.reduce((sum, m) => sum + m.total, 0) / members.length;
        const threshold = avgArrows / 2; // 平均の半分
        setRankings({
          hitRate: members.filter(m => m.total >= threshold).map(m => ({ ...m, value: Math.round((m.hits/m.total)*100) })).sort((a,b)=>b.value-a.value).slice(0,5),
          totalArrows: members.map(m => ({ ...m, value: m.total })).sort((a,b)=>b.value-a.value).slice(0,5),
          totalHits: members.map(m => ({ ...m, value: m.hits })).sort((a,b)=>b.value-a.value).slice(0,5),
          tachiRate: members.filter(m => m.total >= threshold && m.tachiTotal > 0).map(m => ({ ...m, value: Math.round((m.tachiHits/m.tachiTotal)*100) })).sort((a,b)=>b.value-a.value).slice(0,5)
        });
      }

      const monthlyMembers = Object.values(monthlyStats).filter(m => m.total > 0);
      if (monthlyMembers.length > 0) {
        const monthlyAvg = monthlyMembers.reduce((sum, m) => sum + m.total, 0) / monthlyMembers.length;
        const mThreshold = monthlyAvg / 2; // 今月の平均の半分
        setMonthlyRankings({
          hitRate: monthlyMembers.filter(m => m.total >= mThreshold).map(m => ({ ...m, value: Math.round((m.hits/m.total)*100) })).sort((a,b)=>b.value-a.value),
          totalArrows: monthlyMembers.map(m => ({ ...m, value: m.total })).sort((a,b)=>b.value-a.value),
          totalHits: monthlyMembers.map(m => ({ ...m, value: m.hits })).sort((a,b)=>b.value-a.value),
          tachiRate: monthlyMembers.filter(m => m.total >= mThreshold && m.tachiTotal > 0).map(m => ({ ...m, value: Math.round((m.tachiHits/m.tachiTotal)*100) })).sort((a,b)=>b.value-a.value)
        });
      }
    } catch (err: any) {
      console.error("ランキング取得エラー:", err.message);
    }
  };

  // ========== 🖥️ UI 表示の分岐 ==========

  // 1. ローディング画面
  if (authLoading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500 font-bold animate-pulse">読み込み中...</p></div>;

  // 2. 未ログインの場合（ログイン・登録画面）
  if (!user) {
    return (
      <main className="p-6 max-w-sm mx-auto min-h-screen flex flex-col justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
          <h1 className="text-2xl font-black text-center mb-2 text-gray-800">🎯 弓道ノート</h1>
          <p className="text-xs text-center text-gray-400 font-bold mb-8">{isLoginMode ? "アカウントにログイン" : "新しくアカウントを作る"}</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">メールアドレス</label>
              <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" placeholder="example@email.com" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">パスワード</label>
              <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" placeholder="6文字以上" />
            </div>
            <button type="submit" className="w-full py-4 bg-blue-500 text-white font-bold rounded-xl shadow-md hover:bg-blue-600 active:scale-95 transition-all mt-4">
              {isLoginMode ? "ログイン" : "登録する"}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-gray-100 pt-6">
            <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-xs font-bold text-gray-500 hover:text-blue-500 underline underline-offset-4">
              {isLoginMode ? "初めての方はこちら（新規登録）" : "すでにアカウントをお持ちの方"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 3. ログイン済だけど、名簿と紐づいていない場合（初回限定画面）
  if (!linkedArcher) {
    const unlinkedArchers = archers.filter(a => !a.user_id);
    return (
      <main className="p-6 max-w-sm mx-auto min-h-screen flex flex-col justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-blue-100 text-center">
          <span className="text-4xl block mb-4">🤝</span>
          <h2 className="text-xl font-black text-gray-800 mb-2">名簿との連携</h2>
          <p className="text-xs text-gray-500 mb-6 font-bold">あなたは名簿の中の誰ですか？<br/>選んだ名前とアカウントを紐づけます。</p>
          
          <select value={linkArcherId} onChange={e => setLinkArcherId(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none mb-6">
            <option value="">自分の名前を選択...</option>
            {unlinkedArchers.map(a => <option key={a.id} value={a.id}>{a.grade} {a.name}</option>)}
          </select>
          
          <button onClick={handleLinkArcher} disabled={!linkArcherId} className="w-full py-4 bg-green-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 active:scale-95 transition-all">
            この名前で紐づける
          </button>
        </div>
      </main>
    );
  }

  // 4. メインアプリ画面（ログイン＆紐付け完了）
  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto min-h-screen bg-gray-50 text-black font-sans pb-20">
      
      {/* 🟢 ヘッダー部分 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">🎯 弓道Webアプリ</h1>
        <button onClick={handleLogout} className="text-[10px] font-bold text-gray-400 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-100">
          ログアウト
        </button>
      </div>

      <div className="flex bg-gray-200 p-1 rounded-2xl mb-8 shadow-inner overflow-x-auto">
        {[
          {id: "individual", label: "個人"}, {id: "team", label: "団体"}, {id: "analysis", label: "分析"},
          {id: "rankings", label: "🏆"}, {id: "members", label: "名簿"}, {id: "schedule", label: "予定"}
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 min-w-[50px] py-2.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all px-1 ${activeTab === tab.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:bg-gray-300"}`}>{tab.label}</button>
        ))}
      </div>

      {/* ========== 👤 個人タブ ========== */}
      {activeTab === "individual" && (
        <div className="animate-fade-in">
          <div className="mb-6 p-5 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4">
            
            <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm border border-blue-100">👤</div>
              <div>
                <p className="text-[10px] font-bold text-blue-500 mb-0.5">ログイン中の部員</p>
                <p className="text-lg font-black text-gray-800">{linkedArcher.grade} {linkedArcher.name}</p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">練習種別</label>
              <div className="flex gap-2">
                {PRACTICE_TYPES.map(type => (
                  <button key={type} onClick={() => setIndPracticeType(type)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border-2 ${indPracticeType === type ? "bg-blue-50 border-blue-500 text-blue-600" : "bg-white border-gray-100 text-gray-400"}`}>{type}</button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="space-y-6 mb-8">
            {indRecords.map((record, rIndex) => (
              <div key={record.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                <p className="text-center text-gray-400 text-xs font-black mb-4">{rIndex + 1}立目</p>
                <div className="flex justify-center gap-4">
                  {record.arrows.map((state, aIndex) => (
                    <button key={aIndex} onClick={() => toggleIndArrow(rIndex, aIndex)} className={`flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full text-3xl font-bold transition-all border-4 ${state === "○" ? "bg-red-500 text-white border-red-200" : state === "×" ? "bg-blue-500 text-white border-blue-200" : "bg-gray-100 text-gray-300 border-gray-200"}`}>{state}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={() => indRecords.length > 1 && setIndRecords(indRecords.slice(0, -1))} className="py-4 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl">➖ 減らす</button>
            <button onClick={() => setIndRecords([...indRecords, { id: indRecords.length + 1, arrows: ["未", "未", "未", "未"] }])} className="py-4 bg-gray-800 text-white font-bold rounded-2xl">➕ 立を追加</button>
          </div>
          <button onClick={saveIndividual} disabled={isSaving} className="w-full py-5 bg-green-500 text-white text-xl font-bold rounded-2xl shadow-lg active:scale-95 disabled:opacity-50">
            {isSaving ? "送信中..." : "💾 保存してリセット"}
          </button>
        </div>
      )}

      {/* ========== 👥 団体タブ ========== */}
      {activeTab === "team" && (
        <div className="animate-fade-in">
          <div className="mb-6 p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="font-bold text-gray-700 mb-4 text-sm">👥 立の編成 (計{totalSize}人)</h2>
            <div className="flex gap-4 mb-6 bg-gray-50 p-3 rounded-xl">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1">前射場</label>
                <select value={frontSize} onChange={(e) => updateTeamSizes(parseInt(e.target.value), backSize)} className="w-full p-2 border border-gray-200 rounded-lg font-bold text-blue-600 outline-none">
                  {[0, 1, 2, 3, 4, 5].map(num => <option key={num} value={num}>{num}人</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1">後ろ射場</label>
                <select value={backSize} onChange={(e) => updateTeamSizes(frontSize, parseInt(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg font-bold text-blue-600 outline-none">
                  {[0, 1, 2, 3, 4, 5].map(num => <option key={num} value={num}>{num}人</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {teamMembers.map((member, index) => {
                const isFirst = index === 0 || index === frontSize;
                const localIndex = index < frontSize ? index : index - frontSize;
                const localTotal = index < frontSize ? frontSize : backSize;
                return (
                  <div key={index}>
                    {isFirst && <p className="text-[10px] font-bold text-blue-500 mt-3 mb-1">{index < frontSize ? "🎯 前射場" : "🎯 後ろ射場"}</p>}
                    <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl">
                      <div className="w-10 text-[10px] font-black text-white bg-gray-800 py-1 rounded text-center">{getPositionName(localIndex, localTotal)}</div>
                      <select value={member.grade} onChange={(e) => { const newM = [...teamMembers]; newM[index] = { grade: e.target.value, name: "" }; setTeamMembers(newM); }} className="w-16 p-1.5 bg-white border border-gray-200 rounded text-[10px]">
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <select value={member.name} onChange={(e) => { const newM = [...teamMembers]; newM[index].name = e.target.value; setTeamMembers(newM); }} className="flex-1 p-1.5 bg-white border border-gray-200 rounded text-xs">
                        <option value="">選択...</option>
                        {archers.filter(a => a.grade === member.grade).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {totalSize > 0 && (
            <div className="space-y-6 mb-8">
              {teamRounds.map((round, rIndex) => (
                <div key={round.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-200 relative overflow-hidden">
                  <p className="text-center text-gray-400 text-[10px] font-black mb-3">{rIndex + 1}立目</p>
                  <div className="space-y-2">
                    {round.arrows.map((personArrows, mIndex) => (
                      <div key={mIndex} className="flex items-center gap-2 border-b border-gray-50 pb-2 last:border-0">
                        <div className="w-12"><span className="font-bold text-gray-700 text-[10px] truncate block">{teamMembers[mIndex]?.name || "未選択"}</span></div>
                        <div className="flex gap-2 sm:gap-3 flex-1 justify-end">
                          {personArrows.map((state, aIndex) => (
                            <button key={aIndex} onClick={() => toggleTeamArrow(rIndex, mIndex, aIndex)} className={`flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold transition-all border-2 ${state === "○" ? "bg-red-500 text-white border-red-100" : state === "×" ? "bg-blue-500 text-white border-blue-100" : "bg-gray-100 text-gray-300 border-gray-100"}`}>{state}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={() => teamRounds.length > 1 && setTeamRounds(teamRounds.slice(0, -1))} className="py-4 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl">➖ 減らす</button>
            <button onClick={() => setTeamRounds([...teamRounds, { id: teamRounds.length + 1, arrows: Array.from({ length: totalSize }, () => ["未", "未", "未", "未"]) }])} className="py-4 bg-gray-800 text-white font-bold rounded-2xl">➕ 立を追加</button>
          </div>
          <button onClick={saveTeam} disabled={isSaving || totalSize === 0} className="w-full py-5 bg-green-500 text-white text-xl font-bold rounded-2xl shadow-lg active:scale-95 disabled:opacity-50">💾 全員の記録を保存</button>
        </div>
      )}

      {/* ========== 📊 分析タブ ========== */}
      {activeTab === "analysis" && (
        <div className="animate-fade-in space-y-6">
          <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm border border-blue-100">📊</div>
            <div>
              <p className="text-[10px] font-bold text-blue-500 mb-0.5">あなたの分析データ</p>
              <p className="text-lg font-black text-gray-800">{linkedArcher.grade} {linkedArcher.name}</p>
            </div>
          </div>

          {linkedArcher && (
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gray-800 p-4 text-white">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap bg-gray-700 rounded-lg p-1 gap-1">
                    {["all", "year", "month", "week", "custom_month"].map(t => (
                      <button key={t} onClick={() => setAnaTimeframe(t as any)} className={`flex-1 min-w-[50px] text-[10px] py-2 rounded-md font-bold transition-all ${anaTimeframe === t ? "bg-blue-500 shadow" : "text-gray-400"}`}>{t === "all" ? "全" : t === "year" ? "年" : t === "month" ? "月" : t === "week" ? "週" : "指定"}</button>
                    ))}
                  </div>
                  <div className="flex bg-gray-700 rounded-lg p-1">
                    <button onClick={() => setAnaType("all")} className={`flex-1 text-[10px] sm:text-xs py-2 rounded-md font-bold transition-all ${anaType === "all" ? "bg-green-500 shadow" : "text-gray-400"}`}>すべての記録</button>
                    <button onClick={() => setAnaType("tachi")} className={`flex-1 text-[10px] sm:text-xs py-2 rounded-md font-bold transition-all ${anaType === "tachi" ? "bg-green-500 shadow" : "text-gray-400"}`}>立の記録のみ</button>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-8">
                <div className="text-center">
                  <p className="text-[60px] font-black text-blue-600 leading-none">{((analysisData.hits / analysisData.total) * 100).toFixed(1)}<span className="text-xl ml-1">%</span></p>
                  <p className="text-gray-400 font-bold mt-2">{analysisData.hits} 中 / {analysisData.total} 射</p>
                </div>
                <div className="grid grid-cols-5 gap-1 sm:gap-2">
                  {[
                    {l: "皆中", v: tachiStats.kaichu, bg: "bg-red-50", border: "border-red-100", text1: "text-red-400", text2: "text-red-600"},
                    {l: "三中", v: tachiStats.sanchu, bg: "bg-orange-50", border: "border-orange-100", text1: "text-orange-400", text2: "text-orange-600"},
                    {l: "二中", v: tachiStats.nichu, bg: "bg-green-50", border: "border-green-100", text1: "text-green-400", text2: "text-green-600"},
                    {l: "一中", v: tachiStats.itchu, bg: "bg-blue-50", border: "border-blue-100", text1: "text-blue-400", text2: "text-blue-600"},
                    {l: "残念", v: tachiStats.zannen, bg: "bg-gray-50", border: "border-gray-200", text1: "text-gray-400", text2: "text-gray-600"}
                  ].map(s => (
                    <div key={s.l} className={`${s.bg} border ${s.border} py-2 px-1 rounded-xl text-center`}>
                      <p className={`text-[10px] sm:text-xs font-black ${s.text1} mb-1`}>{s.l}</p>
                      <p className={`text-sm sm:text-lg font-black ${s.text2}`}>{s.v}<span className="text-[10px] ml-0.5">回</span></p>
                    </div>
                  ))}
                </div>
                {chartData.length > 0 && (
                  <div className="h-40 w-full"><ResponsiveContainer><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" hide /><YAxis domain={[0, 100]} hide /><Tooltip /><Line type="monotone" dataKey="的中率(%)" stroke="#3b82f6" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-2 mb-4">🏹 立の詳細（矢ごとの的中率）</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {arrowStats.map((stat, index) => {
                      const rate = stat.total > 0 ? ((stat.hits / stat.total) * 100).toFixed(1) : "0.0";
                      return (
                        <div key={index} className="bg-white border-2 border-gray-100 p-3 rounded-xl text-center relative overflow-hidden shadow-sm">
                          <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-1000" style={{ width: `${rate}%` }}></div>
                          <p className="text-[10px] font-black text-gray-400 mb-1">{index + 1}本目</p>
                          <p className="text-xl font-black text-gray-800">{rate}<span className="text-xs ml-0.5">%</span></p>
                          <p className="text-[10px] text-gray-400 mt-1">{stat.hits}/{stat.total}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== 🏆 ランキングタブ ========== */}
      {activeTab === "rankings" && (
        <div className="animate-fade-in space-y-8">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 text-center border-b pb-2">👑 全期間ランキング (TOP5)</h2>
            <p className="text-[10px] text-gray-400 text-center font-bold mb-4">※的中率は「平均矢数の半分以上」を引いている人のみ</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {title: "🎯 的中率", data: rankings.hitRate, unit: "%", color: "text-red-500"},
                {title: "🔥 矢数", data: rankings.totalArrows, unit: "射", color: "text-blue-500"},
                {title: "🌟 的中数", data: rankings.totalHits, unit: "中", color: "text-green-500"},
                {title: "🥋 立的中率", data: rankings.tachiRate, unit: "%", color: "text-purple-500"}
              ].map(r => (
                <div key={r.title} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-black text-gray-400 mb-4 border-b pb-2">{r.title}</h3>
                  <div className="space-y-3">
                    {r.data && r.data.length > 0 ? r.data.map((m, i) => (
                      <div key={m.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${i === 0 ? "bg-yellow-400 text-white" : "bg-gray-100 text-gray-400"}`}>{i+1}</span>
                          <span className="text-sm font-bold text-gray-700">{m.name}</span>
                        </div>
                        <span className={`text-sm font-black ${r.color}`}>{m.value}{r.unit}</span>
                      </div>
                    )) : <p className="text-[10px] text-gray-300 py-4 text-center">データがありません</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-200">
            {!isUnlocked ? (
              <div className="bg-white p-6 rounded-3xl border border-dashed border-gray-300 text-center">
                <h3 className="text-sm font-bold text-gray-500 mb-4">🔐 今月の全順位（月的表） - 管理者用</h3>
                <div className="flex gap-2 max-w-xs mx-auto">
                  <input type="password" placeholder="パスワード" value={passInput} onChange={(e)=>setPassInput(e.target.value)} className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" />
                  <button onClick={() => { if(passInput===SECRET_PASSWORD){setIsUnlocked(true);setPassInput("");}else{alert("パスワードが違います");} }} className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all">解除</button>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in space-y-4">
                <div className="flex justify-between items-center bg-gray-800 p-4 rounded-2xl text-white mb-6">
                  <h2 className="text-lg font-bold">📅 今月の全順位（月的表）</h2>
                  <button onClick={() => setIsUnlocked(false)} className="text-[10px] bg-gray-600 hover:bg-gray-500 font-bold px-3 py-1.5 rounded-full transition-all">ロック</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {title: "🎯 今月の的中率", data: monthlyRankings.hitRate, unit: "%", color: "text-red-500"},
                    {title: "🔥 今月の矢数", data: monthlyRankings.totalArrows, unit: "射", color: "text-blue-500"},
                    {title: "🌟 今月の的中数", data: monthlyRankings.totalHits, unit: "中", color: "text-green-500"},
                    {title: "🥋 今月の立的中率", data: monthlyRankings.tachiRate, unit: "%", color: "text-purple-500"}
                  ].map(r => (
                    <div key={r.title} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex flex-col max-h-96">
                      <h3 className="text-xs font-black text-gray-500 mb-4 border-b pb-2 sticky top-0 bg-white z-10">{r.title} <span className="font-normal text-[10px]">({r.data ? r.data.length : 0}人)</span></h3>
                      <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                        {r.data && r.data.length > 0 ? r.data.map((m, i) => (
                          <div key={m.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${i === 0 ? "bg-yellow-400 text-white" : "bg-gray-100 text-gray-400"}`}>{i+1}</span>
                              <span className="text-sm font-bold text-gray-700">{m.name}</span>
                            </div>
                            <span className={`text-sm font-black ${r.color}`}>{m.value}{r.unit}</span>
                          </div>
                        )) : <p className="text-[10px] text-gray-300 py-4 text-center">今月のデータはありません</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== 📖 名簿タブ ========== */}
      {activeTab === "members" && (
        <div className="animate-fade-in space-y-6">
          {!isMembersUnlocked ? (
            <div className="bg-white p-8 rounded-3xl border border-dashed border-gray-300 text-center mt-4">
              <h2 className="text-lg font-bold text-gray-700 mb-2">👤 メンバー登録 (管理者用)</h2>
              <div className="flex gap-2 max-w-xs mx-auto">
                <input type="password" placeholder="パスワード" value={membersPassInput} onChange={(e)=>setMembersPassInput(e.target.value)} className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" />
                <button onClick={() => { if(membersPassInput===SECRET_PASSWORD){setIsMembersUnlocked(true);setMembersPassInput("");}else{alert("パスワードが違います");} }} className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all">解除</button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-3xl border border-gray-200">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800">👤 メンバー登録</h2>
                <button onClick={() => setIsMembersUnlocked(false)} className="text-[10px] text-gray-400 font-bold border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50">ロックする</button>
              </div>
              <div className="space-y-4">
                <select value={newArcherGrade} onChange={(e) => setNewArcherGrade(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-blue-600 outline-none">
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="text" placeholder="名前" value={newArcherName} onChange={(e) => setNewArcherName(e.target.value)} className="w-full p-4 border border-gray-200 bg-gray-50 rounded-xl outline-none" />
                <button onClick={handleAddArcher} className="w-full py-4 bg-blue-500 text-white font-bold rounded-xl active:scale-95 transition-transform">名簿に登録</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">📅 今月の予定</h2>
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src="/schedule.jpg" alt="予定表" className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}