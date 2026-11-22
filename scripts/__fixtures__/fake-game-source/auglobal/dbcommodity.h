enum COMMODITYID
{
	CID_A = 1,
	CID_B,
	CID_Water = 83,
};
inline COMMODITYID HarvestProspectorCommodity(int index)
{
	COMMODITYID res[] =
	{
		CID_A,
	};
	return res[0];
}
inline COMMODITYID HarvestWildcatterCommodity(int index)
{
	COMMODITYID res[] =
	{
		CID_B,
	};
	return res[0];
}
inline COMMODITYID HarvestSiphonCommodity(int index)
{
	COMMODITYID res[] =
	{
		CID_B,
	};
	return res[0];
}
inline COMMODITYID HarvestAtmosphereCommodity(int index)
{
	COMMODITYID res[] =
	{
		CID_B,
	};
	return res[0];
}
inline COMMODITYID HarvestParticleCommodity(int index)
{
	COMMODITYID res[] =
	{
		CID_B,
	};
	return res[0];
}
inline bool IsNaturalResource(COMMODITYID cid)
{
	switch(cid)
	{
		case CID_A:
		case CID_B:
		case CID_Water:
			return true;
	}
	return false;
}
