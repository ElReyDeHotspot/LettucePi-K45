# Smart Queue

CAKE upload shaping for the unchanged K45P Linux 6.12.94 vendor kernel.
Download retains the verified nftables limiter; IFB redirection failed live traffic tests and is not shipped.

Source, compiler and kernel ABI follow [the NFQUEUE build](../zapret2/README.md).
Rebuilt `sch_tbf` and `sch_ingress` match the vendor reference code/data sections.
No kernel replacement, forced module load or ABI override is used.

Build with `build-module.sh /absolute/fresh/build-directory`, then package with
`package-module.sh /path/to/build-directory`. The image recipe includes the pinned APK.
Smart Queue stays off until enabled. TBF/fq_codel remains the fallback if CAKE cannot load.
